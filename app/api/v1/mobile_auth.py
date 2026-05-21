"""
Mobile OTP Authentication Router
---------------------------------
POST /auth/send-otp    — generate & print OTP (demo mode)
POST /auth/verify-otp  — verify OTP, issue JWT, create/restore user
"""
import re
import uuid
import socket
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, OperationalError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_audit_meta
from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import get_db
from app.models.user import User, UserRole
from app.services.kyc_session_service import ensure_active_kyc_session, ensure_tenant_for_user
from app.services.otp_service import send_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["Mobile OTP Auth"])
logger = get_logger(__name__)

# ── Schemas ───────────────────────────────────────────────────────────────────

PHONE_RE = re.compile(r"^\+[1-9]\d{6,14}$")


class SendOtpRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip().replace(" ", "").replace("-", "")
        if not PHONE_RE.match(v):
            raise ValueError("Phone must be in E.164 format, e.g. +919876543210")
        return v


class SendOtpResponse(BaseModel):
    success: bool
    message: str


class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip().replace(" ", "").replace("-", "")
        if not PHONE_RE.match(v):
            raise ValueError("Invalid phone format")
        return v

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class UserInfo(BaseModel):
    id: str
    tenant_id: str | None = None
    phone: str
    role: str


class VerifyOtpResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserInfo
    onboarding_status: str


# ── JWT helpers ───────────────────────────────────────────────────────────────

def _phone_supabase_uid(phone: str) -> str:
    return f"otp:{phone}"


def _phone_email(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    return f"otp-{digits}@example.com"


def _issue_access_token(user: User, phone: str) -> str:
    payload = {
        "sub": str(user.id),
        "phone": phone,
        "role": user.role.value,
        "iss": "veritasaml-otp",
        "exp": datetime.utcnow() + timedelta(hours=8),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def _issue_refresh_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "type": "refresh",
        "iss": "veritasaml-otp",
        "exp": datetime.utcnow() + timedelta(days=30),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


# ── Audit helper ──────────────────────────────────────────────────────────────

async def _audit(db: AsyncSession, actor_id, action: str, meta: dict) -> None:
    from app.models.user import User as _U  # avoid circular at module level
    from sqlalchemy import text
    try:
        await db.execute(
            text(
                "INSERT INTO audit_logs (id, actor_id, action, resource_type, ip_address, user_agent, created_at) "
                "VALUES (:id, :actor_id, :action, :rt, :ip, :ua, NOW())"
            ),
            {
                "id": str(uuid.uuid4()),
                "actor_id": str(actor_id) if actor_id else None,
                "action": action,
                "rt": "auth",
                "ip": meta.get("ip_address"),
                "ua": meta.get("user_agent"),
            },
        )
        await db.commit()
    except Exception:
        pass  # audit failure must never break auth


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/send-otp", response_model=SendOtpResponse)
async def send_otp_endpoint(
    payload: SendOtpRequest,
    request: Request,
    meta: dict = Depends(get_audit_meta),
):
    try:
        result = await send_otp(payload.phone)
        return SendOtpResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))


@router.post("/verify-otp", response_model=VerifyOtpResponse)
async def verify_otp_endpoint(
    payload: VerifyOtpRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    meta: dict = Depends(get_audit_meta),
):
    # 1. Verify OTP
    try:
        valid = await verify_otp(payload.phone, payload.otp)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP. Please try again.",
        )

    # 2. Find or create user
    try:
        result = await db.execute(
            select(User).where(User.supabase_uid == _phone_supabase_uid(payload.phone))
        )
        user = result.scalar_one_or_none()
    except (socket.gaierror, OSError, OperationalError, DBAPIError) as e:
        logger.error(
            "otp_verify_db_lookup_failed",
            phone=payload.phone,
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed. Please try again.",
        )
    except SQLAlchemyError as e:
        logger.error(
            "otp_verify_db_lookup_sqlalchemy_failed",
            phone=payload.phone,
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable. Please try again.",
        )

    is_new = user is None
    try:
        if is_new:
            user = User(
                supabase_uid=_phone_supabase_uid(payload.phone),
                email=_phone_email(payload.phone),
                role=UserRole.customer,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            if not user.is_active:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive.")
            await db.commit()
            await db.refresh(user)
        await ensure_tenant_for_user(db, user)
        session = await ensure_active_kyc_session(db, user)
        await db.commit()
        await db.refresh(user)
    except HTTPException:
        raise
    except (socket.gaierror, OSError, OperationalError, DBAPIError) as e:
        logger.error(
            "otp_verify_db_write_failed",
            phone=payload.phone,
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed. Please try again.",
        )
    except SQLAlchemyError as e:
        logger.error(
            "otp_verify_db_write_sqlalchemy_failed",
            phone=payload.phone,
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable. Please try again.",
        )

    # 3. Determine onboarding status
    try:
        from sqlalchemy import text
        row = await db.execute(
            text("SELECT current_status FROM onboarding_state WHERE user_id = :uid LIMIT 1"),
            {"uid": str(user.id)},
        )
        ob_row = row.fetchone()
        onboarding_status = ob_row[0] if ob_row else "REGISTERED"
    except (socket.gaierror, OSError):
        onboarding_status = "REGISTERED"
    except Exception:
        onboarding_status = "REGISTERED"

    # 4. Issue tokens
    access_token = _issue_access_token(user, payload.phone)
    refresh_token = _issue_refresh_token(user)

    # 5. Audit log
    await _audit(db, user.id, "otp_login_success" if not is_new else "otp_register", meta)

    return VerifyOtpResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserInfo(id=str(user.id), tenant_id=str(user.tenant_id) if user.tenant_id else None, phone=payload.phone, role=user.role.value),
        onboarding_status=onboarding_status,
    )
