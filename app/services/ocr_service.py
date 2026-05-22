import re
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ── AWS Textract (disabled — kept for future use) ─────────────────────────────
# import boto3
# def _textract_extract(s3_key: str) -> dict: ...
# def _get_text_textract(block, block_map) -> str: ...


# ── EasyOCR (primary) ────────────────────────────────────────────────────────

_easyocr_reader = None
BLUR_THRESHOLD = 80.0  # Laplacian variance below this → reject as blurry


def _get_ocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        _easyocr_reader = easyocr.Reader(["en"], gpu=False)
    return _easyocr_reader


def prewarm_ocr_reader():
    """Call once at worker startup to download/load model before first request."""
    _get_ocr_reader()
    logger.info("easyocr_model_prewarmed")


def _check_blur(gray) -> float:
    import cv2
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def _autocrop_document(img):
    """Detect card contour and perspective-transform. Returns cropped img or original."""
    import cv2
    import numpy as np

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)

    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            pts = approx.reshape(4, 2).astype(np.float32)
            # Order: top-left, top-right, bottom-right, bottom-left
            s = pts.sum(axis=1)
            diff = np.diff(pts, axis=1)
            ordered = np.array([
                pts[np.argmin(s)],
                pts[np.argmin(diff)],
                pts[np.argmax(s)],
                pts[np.argmax(diff)],
            ], dtype=np.float32)
            w = int(max(
                np.linalg.norm(ordered[1] - ordered[0]),
                np.linalg.norm(ordered[2] - ordered[3]),
            ))
            h = int(max(
                np.linalg.norm(ordered[3] - ordered[0]),
                np.linalg.norm(ordered[2] - ordered[1]),
            ))
            if w < 100 or h < 60:  # too small to be a real card
                continue
            dst = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
            M = cv2.getPerspectiveTransform(ordered, dst)
            return cv2.warpPerspective(img, M, (w, h))

    return img  # no card found — use full image


def _easyocr_extract(s3_key: str) -> dict:
    import cv2
    import numpy as np
    import tempfile
    import os
    import boto3 as _boto3

    s3 = _boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )
    obj = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    img_bytes = obj["Body"].read()

    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    blur_score = _check_blur(gray)
    if blur_score < BLUR_THRESHOLD:
        logger.warning("ocr_image_too_blurry", s3_key=s3_key, blur_score=round(blur_score, 2))
        # Try enhanced preprocessing for blurry images
        return _enhanced_ocr_pipeline(img, s3_key)

    img = _autocrop_document(img)
    
    # Multi-strategy OCR approach
    best_result = _multi_strategy_ocr(img)
    
    if not best_result["fields"] or len(best_result["fields"]) < 2:
        # Fallback to enhanced pipeline
        logger.info("ocr_fallback_to_enhanced", s3_key=s3_key)
        return _enhanced_ocr_pipeline(img, s3_key)
    
    return best_result


def _multi_strategy_ocr(img) -> dict:
    """Try multiple OCR preprocessing strategies and pick the best result."""
    import cv2
    import tempfile
    import os
    
    strategies = [
        ("adaptive_thresh", _preprocess_adaptive),
        ("otsu_thresh", _preprocess_otsu), 
        ("morphology", _preprocess_morphology),
        ("contrast_enhance", _preprocess_contrast),
    ]
    
    best_result = {"fields": {}, "confidence_scores": {}}
    best_score = 0
    
    for strategy_name, preprocess_func in strategies:
        try:
            processed = preprocess_func(img)
            
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                cv2.imwrite(tmp_path, processed)
                results = _get_ocr_reader().readtext(tmp_path)
            finally:
                os.unlink(tmp_path)
            
            # Score this result
            structured = [
                {"text": r[1], "confidence": round(r[2], 3), "bbox": r[0]}
                for r in results if r[2] > 0.3
            ]
            
            if not structured:
                continue
                
            fields = _parse_pan_card(structured)
            avg_conf = sum(r["confidence"] for r in structured) / len(structured)
            
            # Score = field count * avg confidence * completeness bonus
            completeness = 1.0
            if "document_number" in fields:
                completeness += 0.3
            if "date_of_birth" in fields:
                completeness += 0.3
            if "name" in fields:
                completeness += 0.2
                
            score = len(fields) * avg_conf * completeness
            
            if score > best_score:
                best_score = score
                best_result = {
                    "fields": fields,
                    "confidence_scores": {k: avg_conf for k in fields if k != "raw_text"},
                    "strategy_used": strategy_name
                }
                
        except Exception as e:
            logger.warning(f"ocr_strategy_failed", strategy=strategy_name, error=str(e))
            continue
    
    return best_result


def _enhanced_ocr_pipeline(img, s3_key: str) -> dict:
    """Enhanced OCR pipeline for difficult images with manual fallback option."""
    import cv2
    import tempfile
    import os
    
    # Try aggressive enhancement
    enhanced = _aggressive_enhance(img)
    
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        cv2.imwrite(tmp_path, enhanced)
        results = _get_ocr_reader().readtext(tmp_path)
    finally:
        os.unlink(tmp_path)
    
    structured = [
        {"text": r[1], "confidence": round(r[2], 3), "bbox": r[0]}
        for r in results if r[2] > 0.2  # Lower threshold for difficult images
    ]
    
    fields = _parse_pan_card(structured)
    
    # If still no good results, return partial data with manual review flag
    if not fields or len(fields) < 2:
        logger.warning("ocr_requires_manual_review", s3_key=s3_key)
        return {
            "fields": fields,
            "confidence_scores": {k: 30.0 for k in fields},  # Low confidence
            "requires_manual_review": True,
            "raw_ocr_text": "\n".join([r["text"] for r in structured]),
            "error": "low_accuracy_manual_review_required"
        }
    
    confs = [r["confidence"] for r in structured]
    avg_conf = round(sum(confs) / len(confs), 2) if confs else 30.0
    
    return {
        "fields": fields,
        "confidence_scores": {k: avg_conf for k in fields if k != "raw_text"}
    }


def _preprocess_adaptive(img):
    """Adaptive thresholding preprocessing."""
    import cv2
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    gray = cv2.bilateralFilter(gray, 11, 17, 17)
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)


def _preprocess_otsu(img):
    """Otsu thresholding preprocessing."""
    import cv2
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def _preprocess_morphology(img):
    """Morphological operations preprocessing."""
    import cv2
    import numpy as np
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    kernel = np.ones((2, 2), np.uint8)
    gray = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
    gray = cv2.medianBlur(gray, 3)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def _preprocess_contrast(img):
    """Contrast enhancement preprocessing."""
    import cv2
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    _, thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def _aggressive_enhance(img):
    """Aggressive enhancement for very difficult images."""
    import cv2
    import numpy as np
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    
    # Noise reduction
    denoised = cv2.fastNlMeansDenoising(gray)
    
    # Contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    
    # Sharpening
    kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    
    # Final thresholding
    _, thresh = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return thresh

    # Preserve structured output — sorted top-to-bottom by bbox y-coordinate
    structured = [
        {"text": r[1], "confidence": round(r[2], 3), "bbox": r[0]}
        for r in results if r[2] > 0.3
    ]
    structured.sort(key=lambda x: x["bbox"][0][1])

    fields = _parse_pan_card(structured)

    confs = [r["confidence"] for r in structured]
    avg_conf = round(sum(confs) / len(confs), 2) if confs else 0.0
    confidence_scores = {k: avg_conf for k in fields if k != "raw_text"}

    logger.info(
        "ocr_pan_parsed",
        detected_pan=fields.get("document_number"),
        detected_dob=fields.get("date_of_birth"),
        detected_name=fields.get("name"),
        ocr_lines=[r["text"] for r in structured],
    )

    return {"fields": fields, "confidence_scores": confidence_scores}


_PAN_NOISE = re.compile(
    r"income|tax|department|govt|government|india|permanent|account|signature|\bof\b",
    re.I,
)
_PAN_NUMBER = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
_DOB_PATTERN = re.compile(r"\b(\d{2}[/\-.\s]\d{2}[/\-.\s]\d{4})\b")


def _parse_pan_card(structured: list) -> dict:
    lines = [r["text"].strip() for r in structured if r["text"].strip()]
    upper_lines = [l.upper() for l in lines]

    fields: dict = {}

    # Step 1 — PAN number
    for line in upper_lines:
        m = _PAN_NUMBER.search(line)
        if m:
            fields["document_number"] = m.group()
            break

    # Step 2 — DOB
    dob_idx = None
    for i, line in enumerate(upper_lines):
        m = _DOB_PATTERN.search(line)
        if m:
            fields["date_of_birth"] = m.group(1)
            dob_idx = i
            break

    # Step 3 — Name and Father name by position relative to DOB
    # PAN layout: INCOME TAX ... | NAME | FATHER NAME | DOB | PAN
    if dob_idx is not None:
        candidates = [
            (i, lines[i]) for i in range(dob_idx)
            if not _PAN_NOISE.search(lines[i]) and len(lines[i].strip()) > 2
        ]
        if len(candidates) >= 2:
            fields["name"] = candidates[-2][1].strip()
            fields["father_name"] = candidates[-1][1].strip()
        elif len(candidates) == 1:
            fields["name"] = candidates[-1][1].strip()

    fields["raw_text"] = "\n".join(lines[:30])
    return fields


# ── Public interface ──────────────────────────────────────────────────────────

def extract_document_fields(s3_key: str) -> dict:
    """EasyOCR-only extraction with PAN-specific positional parser."""
    try:
        result = _easyocr_extract(s3_key)
        logger.info("ocr_via_easyocr", s3_key=s3_key, field_count=len(result["fields"]))
        return result
    except Exception as exc:
        logger.error("ocr_failed", s3_key=s3_key, error=str(exc))
        return {"fields": {}, "confidence_scores": {}}
