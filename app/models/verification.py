import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, JSON, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class FaceVerification(Base):
    __tablename__ = "face_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    selfie_s3_key = Column(String(500))
    id_document_s3_key = Column(String(500))
    similarity_score = Column(Numeric(5, 2))
    confidence_score = Column(Numeric(5, 2))
    is_match = Column(Boolean)
    rekognition_response = Column(JSON)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
