from uuid import UUID
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    supabase_uid: str | None = None
    role: UserRole = UserRole.customer


class UserOut(BaseModel):
    id: UUID
    email: EmailStr | None = None
    phone_number: str | None = None
    role: UserRole
    is_active: bool
    mfa_enabled: bool

    model_config = {"from_attributes": True}


class TokenPayload(BaseModel):
    sub: str
    email: str | None = None
