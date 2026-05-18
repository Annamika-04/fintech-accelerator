from pydantic import BaseModel
from uuid import UUID
from app.models.risk import RiskDecision


class RiskScoreRequest(BaseModel):
    user_id: str
    kyc_verified: bool = False
    doc_confidence_avg: float = 0.0
    face_similarity: float = 0.0
    is_pep: bool = False
    is_sanctioned: bool = False
    adverse_media: bool = False
    country_code: str = "IN"
    login_anomaly: bool = False
    transaction_velocity: int = 0
    ip_risk_score: int = 0
    has_complex_ownership: bool = False


class RiskScoreOut(BaseModel):
    id: UUID
    final_score: int
    decision: RiskDecision
    kyc_risk: int
    aml_risk: int
    geographic_risk: int
    behavioural_risk: int
    transaction_risk: int
    device_ip_risk: int
    ownership_structure_risk: int
    score_breakdown: dict | None

    model_config = {"from_attributes": True}
