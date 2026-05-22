from pydantic import BaseModel
from uuid import UUID


ALLOWED_DOCUMENT_TYPES = {
    "passport", "aadhaar", "pan", "driving_license",
    "utility_bill", "company_document", "selfie"
}

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp",
    "application/pdf", "image/tiff"
}


class PresignedURLRequest(BaseModel):
    document_type: str
    filename: str
    content_type: str
    file_size_bytes: int


class PresignedURLResponse(BaseModel):
    upload_url: str
    s3_key: str
    document_id: UUID
    upload_headers: dict[str, str]


class DocumentConfirmRequest(BaseModel):
    document_id: UUID
    file_hash: str


class DirectUploadResponse(BaseModel):
    document_id: UUID
    s3_key: str
    upload_status: str
    verification_status: str


from datetime import datetime
from pydantic import BaseModel
from uuid import UUID


class DocumentOut(BaseModel):
    id: UUID
    tenant_id: UUID | None = None
    kyc_session_id: UUID | None = None
    onboarding_id: str | None = None
    document_type: str
    s3_key: str
    upload_status: str
    verification_status: str
    virus_scan_status: str
    created_at: datetime | None

    model_config = {"from_attributes": True}


class DocumentVerificationOut(BaseModel):
    id: UUID
    document_id: UUID
    extracted_fields: dict | None
    confidence_scores: dict | None
    verification_status: str

    model_config = {"from_attributes": True}
