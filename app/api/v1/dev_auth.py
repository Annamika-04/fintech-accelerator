"""
DEV ONLY — issues a local HS256 JWT shaped like a Supabase token for Swagger testing.
Disabled automatically when APP_ENV=production.
"""
from datetime import datetime, timedelta
from jose import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/dev", tags=["Dev Auth (local only)"])


class DevLoginRequest(BaseModel):
    email: str


class DevLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str


@router.post("/login", response_model=DevLoginResponse)
async def dev_login(payload: DevLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    DEV ONLY — returns a Supabase-shaped JWT for a registered user.
    Use this token in Swagger Authorize to test protected endpoints.
    """
    if settings.APP_ENV == "production":
        raise HTTPException(status_code=404, detail="Not found")

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found — register first via POST /auth/register")

    token_data = {
        "sub": user.supabase_uid,
        "email": user.email,
        "role": user.role.value,
        "exp": datetime.utcnow() + timedelta(hours=8),
        "iss": "supabase-dev",
    }
    secret = settings.SUPABASE_JWT_SECRET or settings.SECRET_KEY
    token = jwt.encode(token_data, secret, algorithm="HS256")
    return DevLoginResponse(
        access_token=token,
        user_id=str(user.id),
        role=user.role.value,
    )
