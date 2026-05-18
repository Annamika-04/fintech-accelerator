import enum
import uuid
from sqlalchemy import Boolean, Column, Enum as SAEnum, String
from sqlalchemy.dialects.postgresql import TIMESTAMPTZ, UUID
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
    cognito_sub = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.customer)
    is_active = Column(Boolean, default=True)
    mfa_enabled = Column(Boolean, default=False)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())
