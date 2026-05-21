import uuid
from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    kyc_session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    onboarding_id = Column(String(80), nullable=True, index=True)
    document_type = Column(String(50), nullable=False)
    document_side = Column(String(50), nullable=True)
    document_version = Column(Integer, nullable=False, default=1)
    s3_key = Column(String(500), nullable=False)
    s3_bucket = Column(String(255), nullable=False)
    file_hash = Column(String(64))
    mime_type = Column(String(100))
    file_size_bytes = Column(BigInteger)
    is_encrypted = Column(Boolean, default=True)
    virus_scan_status = Column(String(50), default="pending")
    upload_status = Column(String(50), default="uploaded")
    full_name = Column(String(255))
    s3_url = Column(Text)
    verification_status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DocumentVerification(Base):
    __tablename__ = "document_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    extracted_fields = Column(JSON)
    confidence_scores = Column(JSON)
    textract_job_id = Column(String(255))
    verification_status = Column(String(50), default="pending")
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
