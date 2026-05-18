import uuid
from sqlalchemy import Boolean, Column, ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import TIMESTAMPTZ, UUID
from sqlalchemy.sql import func
from app.db.base import Base


class AMLScreening(Base):
    __tablename__ = "aml_screenings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    profile_type = Column(String(20))
    normalized_name = Column(String(255))
    screening_provider = Column(String(100))
    is_pep = Column(Boolean, default=False)
    is_sanctioned = Column(Boolean, default=False)
    adverse_media_flag = Column(Boolean, default=False)
    match_details = Column(JSON)
    risk_flags = Column(JSON)
    screened_at = Column(TIMESTAMPTZ, server_default=func.now())
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
