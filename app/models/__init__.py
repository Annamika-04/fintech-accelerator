# Import all models here so SQLAlchemy registers them on Base.metadata
from app.models.user import User, UserRole  # noqa: F401
from app.models.tenant import (  # noqa: F401
    Tenant,
    TenantStatus,
    KYCSession,
    KYCSessionStatus,
    KYCStepState,
    KYCStepStatus,
    WorkflowEvent,
    EventPublishStatus,
)
from app.models.document import Document, DocumentVerification  # noqa: F401
from app.models.verification import FaceVerification  # noqa: F401
from app.models.aml import AMLScreening  # noqa: F401
from app.models.risk import RiskScore, Case, AuditLog, Alert  # noqa: F401
from app.models.onboarding import (  # noqa: F401
    IndividualProfile, CorporateProfile,
    CorporateDirector, OnboardingState,
    OnboardingStatus, OnboardingType,
)
