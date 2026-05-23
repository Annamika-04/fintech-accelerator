import re
import unicodedata
from datetime import date
from rapidfuzz import fuzz
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Scoring weights ───────────────────────────────────────────────────────────
WEIGHT_NAME     = 25
WEIGHT_DOB      = 25
WEIGHT_FACE     = 30
WEIGHT_LIVENESS = 10
WEIGHT_QUALITY  = 10

NAME_MATCH_THRESHOLD = 85
FACE_MATCH_THRESHOLD = 60


# ── Normalisation helpers ─────────────────────────────────────────────────────

def _normalize_name(name: str) -> str:
    if not name:
        return ""
    nfkd = unicodedata.normalize("NFKD", name)
    cleaned = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"[^a-z\s]", "", cleaned.lower()).strip()


def _normalize_dob(dob) -> str:
    if not dob:
        return ""
    if isinstance(dob, date):
        return dob.strftime("%Y-%m-%d")
    s = str(dob).strip()
    m = re.match(r"(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})", s)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    m = re.match(r"(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    return s


# ── Individual check functions ────────────────────────────────────────────────

def _score_name(ocr_fields: dict, profile_name: str) -> tuple[int, float, str | None]:
    """Returns (score, ratio, review_reason)"""
    ocr_name = ocr_fields.get("name", "")
    if not ocr_name or not profile_name:
        return int(WEIGHT_NAME * 0.4), 0.0, "Name not found in OCR output (partial credit)"
    ratio = fuzz.ratio(_normalize_name(ocr_name), _normalize_name(profile_name))
    if ratio >= NAME_MATCH_THRESHOLD:
        return WEIGHT_NAME, float(ratio), None
    if ratio >= 70:
        return int(WEIGHT_NAME * 0.5), float(ratio), f"Partial name match (score={ratio})"
    return 0, float(ratio), f"Name mismatch — OCR: '{ocr_name}' vs Profile: '{profile_name}' (score={ratio})"


def _score_dob(ocr_fields: dict, profile_dob) -> tuple[int, str | None]:
    ocr_dob = _normalize_dob(ocr_fields.get("date_of_birth", ""))
    prof_dob = _normalize_dob(profile_dob)
    if not ocr_dob or not prof_dob:
        return int(WEIGHT_DOB * 0.4), "Date of birth not found in OCR output (partial credit)"
    if ocr_dob == prof_dob:
        return WEIGHT_DOB, None
    return 0, f"DOB mismatch — OCR: {ocr_dob} vs Profile: {prof_dob}"


def _score_face(face_result: dict) -> tuple[int, str | None]:
    if not face_result:
        return 0, "Face verification result missing"
    similarity = face_result.get("similarity_score", 0)
    if similarity >= FACE_MATCH_THRESHOLD:
        scaled = int(WEIGHT_FACE * min(
            (similarity - FACE_MATCH_THRESHOLD) / (100 - FACE_MATCH_THRESHOLD) + 0.5, 1.0
        ))
        return scaled, None
    return 0, f"Low face similarity score ({similarity:.1f})"


def _score_liveness(face_result: dict) -> tuple[int, str | None]:
    if not face_result:
        return 0, "No liveness data available"
    quality = face_result.get("quality", {})
    if quality.get("is_blurry"):
        return 0, f"Selfie is blurry (blur_score={quality.get('blur_score', 0):.1f})"
    if quality.get("poor_lighting"):
        return 0, f"Poor lighting detected (brightness={quality.get('brightness', 0):.1f})"
    if face_result.get("similarity_score", 0) > 0:
        return WEIGHT_LIVENESS, None
    return 0, "Face not detected in selfie"


def _score_quality(ocr_fields: dict, face_result: dict) -> tuple[int, float, str | None]:
    """Returns (score, avg_ocr_confidence, review_reason)"""
    quality = face_result.get("quality", {}) if face_result else {}
    if quality.get("is_blurry") or quality.get("poor_lighting"):
        return 0, 0.0, "Image quality too low for reliable verification"
    conf_scores = [v for v in ocr_fields.get("confidence_scores", {}).values()
                   if isinstance(v, (int, float))]
    avg_conf = round(sum(conf_scores) / len(conf_scores), 2) if conf_scores else 50.0
    if avg_conf >= 70:
        return WEIGHT_QUALITY, avg_conf, None
    return int(WEIGHT_QUALITY * 0.5), avg_conf, f"Low OCR confidence (avg={avg_conf:.1f})"


def _is_definite_face_mismatch(face_result: dict) -> bool:
    if not face_result:
        return False
    similarity = float(face_result.get("similarity_score") or 0)
    if similarity <= 0:
        return False
    return face_result.get("is_match") is False or similarity < FACE_MATCH_THRESHOLD


def _face_mismatch_rejection(face_result: dict) -> dict:
    quality_data = face_result.get("quality", {}) if face_result else {}
    similarity = float(face_result.get("similarity_score") or 0) if face_result else 0.0
    return {
        "kyc_score": 0,
        "decision": "REJECTED",
        "passed": False,
        "bypass_reason": "FACE_MISMATCH",
        "review_reasons": [
            f"Face verification failed: selfie does not match the uploaded ID document (similarity={similarity:.1f}, required={FACE_MATCH_THRESHOLD}).",
            "Please upload a selfie of the same person shown on the identity document.",
        ],
        "confidence": {
            "name_similarity": 0.0,
            "dob_match": False,
            "face_similarity": similarity,
            "face_is_match": False,
            "ocr_confidence_avg": 0.0,
            "blur_score": quality_data.get("blur_score", 0),
            "brightness": quality_data.get("brightness", 0),
            "face_detected": similarity > 0,
        },
        "score_breakdown": {
            "name": 0,
            "dob": 0,
            "face": 0,
            "liveness": 0,
            "quality": 0,
        },
    }


# ── Main validation function ──────────────────────────────────────────────────

def run_kyc_validation(
    ocr_fields: dict,
    profile_name: str,
    profile_dob,
    face_result: dict,
) -> dict:
    # Check if OCR failed or requires manual review
    requires_manual = ocr_fields.get("requires_manual_review", False)
    ocr_error = ocr_fields.get("error")

    if _is_definite_face_mismatch(face_result):
        logger.info(
            "kyc_rejected_face_mismatch",
            profile_name=profile_name,
            similarity=face_result.get("similarity_score", 0) if face_result else 0,
            is_match=face_result.get("is_match") if face_result else None,
        )
        return _face_mismatch_rejection(face_result)
    
    # Configuration-based OCR bypass
    if settings.ENABLE_OCR_BYPASS and (requires_manual or ocr_error):
        logger.info("kyc_bypassed_via_config", 
                   profile_name=profile_name, 
                   ocr_error=ocr_error,
                   bypass_enabled=settings.ENABLE_OCR_BYPASS)
        
        # Use face verification if available, otherwise minimal score
        face_score = _score_face(face_result)[0] if face_result else 0
        live_score = _score_liveness(face_result)[0] if face_result else 0
        
        bypass_score = settings.OCR_BYPASS_SCORE
        decision = "UNDER_REVIEW" if settings.REQUIRE_MANUAL_REVIEW_ON_BYPASS else "AML_PENDING"
        
        return {
            "kyc_score": bypass_score,
            "decision": decision,
            "passed": decision == "AML_PENDING",
            "bypass_reason": "OCR_BYPASS_ENABLED",
            "review_reasons": [
                f"OCR extraction failed ({ocr_error}) - bypass enabled in configuration",
                "Manual verification required for document fields",
                "AML screening proceeding with profile data"
            ],
            "confidence": {
                "name_similarity": 0.0,
                "dob_match": False,
                "face_similarity": face_result.get("similarity_score", 0) if face_result else 0,
                "face_is_match": face_result.get("is_match", False) if face_result else False,
                "ocr_confidence_avg": 0.0,
                "blur_score": 0,
                "brightness": 0,
                "face_detected": bool(face_result),
                "ocr_bypassed": True,
            },
            "score_breakdown": {
                "name": 0,           # OCR bypassed
                "dob": 0,            # OCR bypassed  
                "face": face_score,  # Use actual face score
                "liveness": live_score,  # Use actual liveness score
                "quality": 0,        # OCR bypassed
            },
        }
    
    # Manual review fallback (when bypass is disabled)
    if requires_manual or ocr_error == "low_accuracy_manual_review_required":
        logger.info("kyc_bypassed_for_manual_review", 
                   profile_name=profile_name, 
                   ocr_error=ocr_error)
        
        # Create a bypass result that moves to manual review but allows AML
        return {
            "kyc_score": 45,  # Just above manual review threshold (40)
            "decision": "UNDER_REVIEW",  # Manual review required
            "passed": False,  # Not auto-approved
            "bypass_reason": "OCR_ACCURACY_INSUFFICIENT",
            "review_reasons": [
                "Document OCR extraction failed - manual verification required",
                "AML screening can proceed with profile data"
            ],
            "confidence": {
                "name_similarity": 0.0,
                "dob_match": False,
                "face_similarity": face_result.get("similarity_score", 0) if face_result else 0,
                "face_is_match": face_result.get("is_match", False) if face_result else False,
                "ocr_confidence_avg": 30.0,
                "blur_score": 0,
                "brightness": 0,
                "face_detected": bool(face_result),
                "manual_review_required": True,
            },
            "score_breakdown": {
                "name": 0,      # OCR failed
                "dob": 0,       # OCR failed  
                "face": _score_face(face_result)[0] if face_result else 0,
                "liveness": _score_liveness(face_result)[0] if face_result else 0,
                "quality": 0,   # OCR failed
            },
        }
    
    # Continue with normal validation if OCR succeeded
    name_score,    name_ratio,   name_reason    = _score_name(ocr_fields, profile_name)
    dob_score,                   dob_reason     = _score_dob(ocr_fields, profile_dob)
    face_score,                  face_reason    = _score_face(face_result)
    live_score,                  live_reason    = _score_liveness(face_result)
    quality_score, avg_ocr_conf, quality_reason = _score_quality(ocr_fields, face_result)

    kyc_score = name_score + dob_score + face_score + live_score + quality_score

    # Collect review reasons — only failed checks
    review_reasons = [r for r in [name_reason, dob_reason, face_reason, live_reason, quality_reason] if r]

    if kyc_score >= 60:
        decision = "AML_PENDING"
    elif kyc_score >= 40:
        decision = "UNDER_REVIEW"
    else:
        decision = "REJECTED"

    quality_data = face_result.get("quality", {}) if face_result else {}

    result = {
        "kyc_score": kyc_score,
        "decision": decision,
        "passed": decision == "AML_PENDING",
        "review_reasons": review_reasons,
        # Full confidence metadata for audit/compliance
        "confidence": {
            "name_similarity": name_ratio,
            "dob_match": dob_score == WEIGHT_DOB,
            "face_similarity": face_result.get("similarity_score", 0) if face_result else 0,
            "face_is_match": face_result.get("is_match", False) if face_result else False,
            "ocr_confidence_avg": avg_ocr_conf,
            "blur_score": quality_data.get("blur_score", 0),
            "brightness": quality_data.get("brightness", 0),
            "face_detected": (face_result.get("similarity_score", 0) > 0) if face_result else False,
        },
        # Per-check scores for breakdown
        "score_breakdown": {
            "name":     name_score,
            "dob":      dob_score,
            "face":     face_score,
            "liveness": live_score,
            "quality":  quality_score,
        },
    }

    logger.info(
        "kyc_validation_complete",
        kyc_score=kyc_score,
        decision=decision,
        review_reasons=review_reasons,
    )
    return result
