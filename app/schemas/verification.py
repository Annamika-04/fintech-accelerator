from pydantic import BaseModel
from uuid import UUID


class FaceVerificationRequest(BaseModel):
    selfie_s3_key: str
    id_document_s3_key: str


class FaceVerificationOut(BaseModel):
    id: UUID
    similarity_score: float | None
    confidence_score: float | None
    is_match: bool | None
    status: str

    model_config = {"from_attributes": True}
