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
    tenant_id: UUID | None = None
    supabase_uid: str
    email: str
    role: UserRole
    is_active: bool
    mfa_enabled: bool

    model_config = {"from_attributes": True}


class TokenPayload(BaseModel):
    sub: str
    email: str | None = None
