import enum
import uuid
from sqlalchemy import Boolean, Column, Enum as SAEnum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import INET, TIMESTAMPTZ, UUID
from sqlalchemy.sql import func
from app.db.base import Base


class RiskDecision(str, enum.Enum):
    AUTO_APPROVE = "AUTO_APPROVE"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    COMPLIANCE_ESCALATION = "COMPLIANCE_ESCALATION"
    AUTO_REJECT = "AUTO_REJECT"


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    kyc_risk = Column(Integer, default=0)
    aml_risk = Column(Integer, default=0)
    geographic_risk = Column(Integer, default=0)
    behavioural_risk = Column(Integer, default=0)
    transaction_risk = Column(Integer, default=0)
    device_ip_risk = Column(Integer, default=0)
    ownership_structure_risk = Column(Integer, default=0)
    final_score = Column(Integer, nullable=False)
    decision = Column(SAEnum(RiskDecision), nullable=False)
    score_breakdown = Column(JSON)
    calculated_at = Column(TIMESTAMPTZ, server_default=func.now())


class Case(Base):
    __tablename__ = "cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    case_type = Column(String(50))
    status = Column(String(50), default="open", index=True)
    priority = Column(String(20), default="medium")
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    risk_score_id = Column(UUID(as_uuid=True), ForeignKey("risk_scores.id"))
    notes = Column(Text)
    resolved_at = Column(TIMESTAMPTZ, nullable=True)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100))
    resource_id = Column(UUID(as_uuid=True))
    ip_address = Column(INET)
    user_agent = Column(Text)
    metadata = Column(JSON)
    created_at = Column(TIMESTAMPTZ, server_default=func.now(), index=True)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    alert_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)
    message = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(TIMESTAMPTZ, nullable=True)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
