import enum
import uuid
from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class UserRole(str, enum.Enum):
    customer = "customer"
    kyc_officer = "kyc_officer"
    aml_analyst = "aml_analyst"
    compliance_manager = "compliance_manager"
    auditor = "auditor"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supabase_uid = Column(String(255), unique=True, nullable=True, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    phone_number = Column(String(20), unique=True, nullable=True, index=True)
    phone_verified = Column(Boolean, default=False)
    role = Column(SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.customer)
    is_active = Column(Boolean, default=True)
    mfa_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
