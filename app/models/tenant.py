import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.base import Base


class TenantStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    archived = "archived"


class KYCSessionStatus(str, enum.Enum):
    draft = "draft"
    registered = "registered"
    type_selected = "type_selected"
    profile_completed = "profile_completed"
    documents_uploaded = "documents_uploaded"
    biometric_pending = "biometric_pending"
    checks_in_progress = "checks_in_progress"
    awaiting_manual_review = "awaiting_manual_review"
    approved = "approved"
    rejected = "rejected"
    expired = "expired"
    abandoned = "abandoned"


class KYCStepStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    blocked = "blocked"
    skipped = "skipped"


class EventPublishStatus(str, enum.Enum):
    pending = "pending"
    published = "published"
    failed = "failed"


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(120), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    status = Column(SAEnum(TenantStatus, name="tenant_status", native_enum=False), nullable=False, default=TenantStatus.active)
    settings = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class KYCSession(Base):
    __tablename__ = "kyc_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    onboarding_id = Column(String(80), unique=True, nullable=False, index=True)
    current_step = Column(String(80), nullable=False, default="account_type")
    status = Column(SAEnum(KYCSessionStatus, name="kyc_session_status", native_enum=False), nullable=False, default=KYCSessionStatus.registered)
    is_active = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)
    failure_reason = Column(Text, nullable=True)
    session_context = Column(JSON, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_activity_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class KYCStepState(Base):
    __tablename__ = "kyc_step_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    kyc_session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    step_code = Column(String(80), nullable=False, index=True)
    status = Column(SAEnum(KYCStepStatus, name="kyc_step_status", native_enum=False), nullable=False, default=KYCStepStatus.pending)
    attempt_count = Column(Integer, nullable=False, default=0)
    payload_snapshot = Column(JSON, nullable=True)
    last_error_code = Column(String(80), nullable=True)
    last_error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class WorkflowEvent(Base):
    __tablename__ = "workflow_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    kyc_session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(String(120), nullable=False, index=True)
    event_status = Column(SAEnum(EventPublishStatus, name="workflow_event_status", native_enum=False), nullable=False, default=EventPublishStatus.pending)
    correlation_id = Column(String(120), nullable=True, index=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
