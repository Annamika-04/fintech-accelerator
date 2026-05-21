import random
import string
from datetime import datetime, timedelta
from jose import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User, UserRole
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["OTP Auth"])

# In-memory OTP store — replace with Redis in production
_otp_store: dict[str, tuple[str, datetime]] = {}


class SendOtpRequest(BaseModel):
    phone: str


class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str


class UserInfo(BaseModel):
    id: str
    phone: str
    role: str


class OtpTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserInfo
    onboarding_status: str = "REGISTERED"


def _make_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "phone": user.phone_number,
        "role": user.role.value,
        "iss": "veritasaml-otp",
        "exp": datetime.utcnow() + timedelta(hours=8),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


@router.post("/send-otp")
async def send_otp(payload: SendOtpRequest, db: AsyncSession = Depends(get_db)):
    otp = "".join(random.choices(string.digits, k=6))
    _otp_store[payload.phone] = (otp, datetime.utcnow() + timedelta(minutes=5))

    # Auto-create user on first contact
    result = await db.execute(select(User).where(User.phone_number == payload.phone))
    if not result.scalar_one_or_none():
        user = User(
            phone_number=payload.phone,
            phone_verified=False,
            role=UserRole.customer,
        )
        db.add(user)
        await db.commit()

    print(f"\n{'='*40}\n OTP for {payload.phone}: {otp}\n{'='*40}\n")
    logger.info("otp_generated", phone=payload.phone, otp=otp)
    return {"message": "OTP sent", "phone": payload.phone}


@router.post("/verify-otp", response_model=OtpTokenResponse)
async def verify_otp(payload: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    stored = _otp_store.get(payload.phone)
    if not stored:
        raise HTTPException(status_code=400, detail="No OTP found. Request a new one.")

    otp_code, expires_at = stored
    if datetime.utcnow() > expires_at:
        _otp_store.pop(payload.phone, None)
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    if payload.otp != otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    _otp_store.pop(payload.phone, None)

    result = await db.execute(select(User).where(User.phone_number == payload.phone))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.phone_verified = True
    await db.commit()
    await db.refresh(user)

    token = _make_token(user)
    return OtpTokenResponse(
        access_token=token,
        refresh_token=token,
        user=UserInfo(id=str(user.id), phone=user.phone_number, role=user.role.value),
        onboarding_status="REGISTERED",
    )
