import re
import unicodedata
from datetime import date
from rapidfuzz import fuzz
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
        return 0, 0.0, "Name not found in OCR output"
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
        return 0, "Date of birth not found in OCR output"
    if ocr_dob == prof_dob:
        return WEIGHT_DOB, None
    return 0, f"DOB mismatch — OCR: {ocr_dob} vs Profile: {prof_dob}"


def _score_face(face_result: dict) -> tuple[int, str | None]:
    if not face_result:
        return 0, "Face verification result missing"
    similarity = face_result.get("similarity_score", 0)
    is_match = face_result.get("is_match", False)
    if is_match and similarity >= FACE_MATCH_THRESHOLD:
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


# ── Main validation function ──────────────────────────────────────────────────

def run_kyc_validation(
    ocr_fields: dict,
    profile_name: str,
    profile_dob,
    face_result: dict,
) -> dict:
    name_score,    name_ratio,   name_reason    = _score_name(ocr_fields, profile_name)
    dob_score,                   dob_reason     = _score_dob(ocr_fields, profile_dob)
    face_score,                  face_reason    = _score_face(face_result)
    live_score,                  live_reason    = _score_liveness(face_result)
    quality_score, avg_ocr_conf, quality_reason = _score_quality(ocr_fields, face_result)

    kyc_score = name_score + dob_score + face_score + live_score + quality_score

    # Collect review reasons — only failed checks
    review_reasons = [r for r in [name_reason, dob_reason, face_reason, live_reason, quality_reason] if r]

    if kyc_score >= 85:
        decision = "AML_PENDING"
    elif kyc_score >= 65:
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
