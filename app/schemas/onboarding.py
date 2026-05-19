from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, EmailStr
from app.models.onboarding import OnboardingStatus, OnboardingType


# ── Address ───────────────────────────────────────────────────────────────────

class AddressSchema(BaseModel):
    line1: str
    line2: str | None = None
    city: str
    state: str | None = None
    postal_code: str
    country: str


# ── Individual ────────────────────────────────────────────────────────────────

class IndividualProfileCreate(BaseModel):
    full_name: str
    date_of_birth: date | None = None
    nationality: str | None = None
    country_of_residence: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    occupation: str | None = None
    tax_id: str | None = None
    address: AddressSchema | None = None


class IndividualProfileOut(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    date_of_birth: date | None
    nationality: str | None
    country_of_residence: str | None
    phone: str | None
    email: str | None
    occupation: str | None
    tax_id: str | None
    address: dict | None
    onboarding_status: OnboardingStatus
    created_at: datetime | None

    model_config = {"from_attributes": True}


# ── Corporate ─────────────────────────────────────────────────────────────────

class CorporateProfileCreate(BaseModel):
    company_name: str
    registration_number: str | None = None
    gstin_ein: str | None = None
    country_of_incorporation: str | None = None
    industry: str | None = None
    registered_address: AddressSchema | None = None
    operating_countries: list[str] | None = None


class CorporateProfileOut(BaseModel):
    id: UUID
    user_id: UUID
    company_name: str
    registration_number: str | None
    gstin_ein: str | None
    country_of_incorporation: str | None
    industry: str | None
    registered_address: dict | None
    operating_countries: list | None
    onboarding_status: OnboardingStatus
    created_at: datetime | None

    model_config = {"from_attributes": True}


# ── Directors ─────────────────────────────────────────────────────────────────

class DirectorCreate(BaseModel):
    full_name: str
    role: str | None = None
    ownership_pct: Decimal = Decimal("0")
    is_ubo: bool = False
    nationality: str | None = None
    date_of_birth: date | None = None
    id_document_type: str | None = None
    id_document_ref: str | None = None


class DirectorOut(BaseModel):
    id: UUID
    corporate_id: UUID
    full_name: str
    role: str | None
    ownership_pct: Decimal
    is_ubo: bool
    nationality: str | None
    date_of_birth: date | None

    model_config = {"from_attributes": True}


# ── Onboarding State ──────────────────────────────────────────────────────────

class OnboardingStateOut(BaseModel):
    user_id: UUID
    onboarding_type: OnboardingType | None
    current_status: OnboardingStatus
    profile_id: UUID | None
    kyc_score: int | None
    aml_score: int | None
    final_score: int | None
    decision: str | None
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class SelectTypeRequest(BaseModel):
    onboarding_type: OnboardingType
