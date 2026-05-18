from dataclasses import dataclass
from app.core.config import settings
from app.models.risk import RiskDecision

HIGH_RISK_COUNTRIES = {"IR", "KP", "SY", "CU", "SD", "MM", "BY", "RU", "VE"}


@dataclass
class RiskInput:
    user_id: str
    kyc_verified: bool
    doc_confidence_avg: float
    face_similarity: float
    is_pep: bool
    is_sanctioned: bool
    adverse_media: bool
    country_code: str
    login_anomaly: bool
    transaction_velocity: int
    ip_risk_score: int
    has_complex_ownership: bool


def calculate_risk(inp: RiskInput) -> dict:
    kyc_risk = _kyc_risk(inp)
    aml_risk = _aml_risk(inp)
    geo_risk = _geo_risk(inp)
    behavioural_risk = _behavioural_risk(inp)
    transaction_risk = _transaction_risk(inp)
    device_ip_risk = min(inp.ip_risk_score, 15)
    ownership_risk = 15 if inp.has_complex_ownership else 0

    final_score = min(
        kyc_risk + aml_risk + geo_risk + behavioural_risk
        + transaction_risk + device_ip_risk + ownership_risk,
        100,
    )

    return {
        "kyc_risk": kyc_risk,
        "aml_risk": aml_risk,
        "geographic_risk": geo_risk,
        "behavioural_risk": behavioural_risk,
        "transaction_risk": transaction_risk,
        "device_ip_risk": device_ip_risk,
        "ownership_structure_risk": ownership_risk,
        "final_score": final_score,
        "decision": _get_decision(final_score).value,
        "score_breakdown": {
            "kyc": kyc_risk,
            "aml": aml_risk,
            "geo": geo_risk,
            "behavioural": behavioural_risk,
            "transaction": transaction_risk,
            "device_ip": device_ip_risk,
            "ownership": ownership_risk,
        },
    }


def _kyc_risk(inp: RiskInput) -> int:
    if not inp.kyc_verified:
        return 25
    if inp.doc_confidence_avg < 70:
        return 20
    if inp.face_similarity < 80:
        return 15
    if inp.face_similarity < 90:
        return 8
    return 0


def _aml_risk(inp: RiskInput) -> int:
    score = 0
    if inp.is_sanctioned:
        score += 50
    if inp.is_pep:
        score += 25
    if inp.adverse_media:
        score += 15
    return min(score, 50)


def _geo_risk(inp: RiskInput) -> int:
    return 20 if inp.country_code.upper() in HIGH_RISK_COUNTRIES else 0


def _behavioural_risk(inp: RiskInput) -> int:
    return 15 if inp.login_anomaly else 0


def _transaction_risk(inp: RiskInput) -> int:
    if inp.transaction_velocity > 100:
        return 15
    if inp.transaction_velocity > 50:
        return 8
    return 0


def _get_decision(score: int) -> RiskDecision:
    if score <= settings.RISK_AUTO_APPROVE_MAX:
        return RiskDecision.AUTO_APPROVE
    if score <= settings.RISK_MANUAL_REVIEW_MAX:
        return RiskDecision.MANUAL_REVIEW
    if score <= settings.RISK_ESCALATION_MAX:
        return RiskDecision.COMPLIANCE_ESCALATION
    return RiskDecision.AUTO_REJECT
