import enum
import uuid
from sqlalchemy import Boolean, Column, Date, DateTime, Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class OnboardingType(str, enum.Enum):
    individual = "individual"
    corporate = "corporate"


class OnboardingStatus(str, enum.Enum):
    REGISTERED = "REGISTERED"
    TYPE_SELECTED = "TYPE_SELECTED"
    PROFILE_COMPLETED = "PROFILE_COMPLETED"
    DOCUMENTS_UPLOADED = "DOCUMENTS_UPLOADED"
    KYC_PENDING = "KYC_PENDING"
    AML_PENDING = "AML_PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FROZEN = "FROZEN"


# Valid forward transitions
TRANSITIONS: dict[OnboardingStatus, list[OnboardingStatus]] = {
    OnboardingStatus.REGISTERED:          [OnboardingStatus.TYPE_SELECTED],
    OnboardingStatus.TYPE_SELECTED:       [OnboardingStatus.PROFILE_COMPLETED],
    OnboardingStatus.PROFILE_COMPLETED:   [OnboardingStatus.DOCUMENTS_UPLOADED],
    OnboardingStatus.DOCUMENTS_UPLOADED:  [OnboardingStatus.KYC_PENDING],
    OnboardingStatus.KYC_PENDING:         [OnboardingStatus.AML_PENDING],
    OnboardingStatus.AML_PENDING:         [OnboardingStatus.UNDER_REVIEW],
    OnboardingStatus.UNDER_REVIEW:        [OnboardingStatus.APPROVED, OnboardingStatus.REJECTED, OnboardingStatus.FROZEN],
    OnboardingStatus.APPROVED:            [],
    OnboardingStatus.REJECTED:            [],
    OnboardingStatus.FROZEN:              [],
}


def can_transition(current: OnboardingStatus, target: OnboardingStatus) -> bool:
    return target in TRANSITIONS.get(current, [])


class IndividualProfile(Base):
    __tablename__ = "individual_profiles"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    full_name            = Column(String(255), nullable=False)
    date_of_birth        = Column(Date)
    nationality          = Column(String(100))
    country_of_residence = Column(String(100))
    phone                = Column(String(50))
    email                = Column(String(255))
    occupation           = Column(String(150))
    tax_id               = Column(String(100))
    address              = Column(JSON)
    onboarding_status    = Column(String(50), nullable=False, default="PROFILE_COMPLETED")
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CorporateProfile(Base):
    __tablename__ = "corporate_profiles"

    id                       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id                  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    company_name             = Column(String(255), nullable=False)
    registration_number      = Column(String(100))
    gstin_ein                = Column(String(100))
    country_of_incorporation = Column(String(100))
    industry                 = Column(String(150))
    registered_address       = Column(JSON)
    operating_countries      = Column(JSON)
    onboarding_status        = Column(String(50), nullable=False, default="PROFILE_COMPLETED")
    created_at               = Column(DateTime(timezone=True), server_default=func.now())
    updated_at               = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CorporateDirector(Base):
    __tablename__ = "corporate_directors"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    corporate_id     = Column(UUID(as_uuid=True), ForeignKey("corporate_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name        = Column(String(255), nullable=False)
    role             = Column(String(100))
    ownership_pct    = Column(Numeric(5, 2), default=0)
    is_ubo           = Column(Boolean, default=False)
    nationality      = Column(String(100))
    date_of_birth    = Column(Date)
    id_document_type = Column(String(50))
    id_document_ref  = Column(String(255))
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class OnboardingState(Base):
    __tablename__ = "onboarding_state"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    onboarding_type  = Column(SAEnum(OnboardingType, name="onboarding_type"), nullable=True)
    current_status   = Column(SAEnum(OnboardingStatus, name="onboarding_status"), nullable=False, default=OnboardingStatus.REGISTERED)
    profile_id       = Column(UUID(as_uuid=True), nullable=True)
    kyc_score        = Column(Integer, nullable=True)
    aml_score        = Column(Integer, nullable=True)
    final_score      = Column(Integer, nullable=True)
    decision         = Column(String(50), nullable=True)
    step_data        = Column(JSON, nullable=False, default=dict)
    last_completed_step = Column(String(50), nullable=True)
    submitted_at     = Column(DateTime(timezone=True), nullable=True)
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
