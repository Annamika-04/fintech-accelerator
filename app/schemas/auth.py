from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    cognito_sub: str
    role: UserRole = UserRole.customer


class UserOut(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    is_active: bool
    mfa_enabled: bool

    model_config = {"from_attributes": True}


class TokenPayload(BaseModel):
    sub: str
    email: str | None = None
    cognito_groups: list[str] = []
