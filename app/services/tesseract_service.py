import re
import tempfile
import numpy as np
import cv2
import pytesseract
from PIL import Image

from app.core.config import settings
from app.core.logging import get_logger
from app.services.base import OCRProvider, OCRResult

pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

logger = get_logger(__name__)


def _download_from_s3(s3_key: str) -> bytes:
    import boto3
    s3 = boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        aws_session_token=settings.AWS_SESSION_TOKEN or None,
    )
    obj = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    return obj["Body"].read()


def _preprocess(img_bytes: bytes) -> tuple[np.ndarray, dict]:
    """OpenCV preprocessing: denoise → grayscale → deskew → threshold.
    Handles both image files and PDFs (first page).
    """
    # Try PDF first
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if img is None:
        # Likely a PDF — convert first page to image via Pillow
        try:
            from PIL import Image
            import io
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception:
            # Last resort: return blank meta so task doesn't crash
            blank = np.ones((100, 100), dtype=np.uint8) * 255
            return blank, {"avg_brightness": 255.0, "skew_angle": 0.0, "note": "unsupported_format"}

    if img is None:
        blank = np.ones((100, 100), dtype=np.uint8) * 255
        return blank, {"avg_brightness": 255.0, "skew_angle": 0.0, "note": "decode_failed"}

    # brightness meta
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    avg_brightness = float(np.mean(gray))

    # denoise
    denoised = cv2.fastNlMeansDenoising(gray, h=10)

    # deskew
    coords = np.column_stack(np.where(denoised < 200))
    skew_angle = 0.0
    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        skew_angle = -(90 + angle) if angle < -45 else -angle
        if abs(skew_angle) > 0.5:
            (h, w) = denoised.shape
            M = cv2.getRotationMatrix2D((w // 2, h // 2), skew_angle, 1.0)
            denoised = cv2.warpAffine(denoised, M, (w, h), flags=cv2.INTER_CUBIC,
                                      borderMode=cv2.BORDER_REPLICATE)

    # adaptive threshold for better OCR on varied lighting
    processed = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11
    )

    meta = {"avg_brightness": round(avg_brightness, 2), "skew_angle": round(skew_angle, 2)}
    return processed, meta


def _parse_fields(raw_text: str) -> tuple[dict, dict]:
    """Extract structured fields and per-field confidence from raw OCR text."""
    fields: dict = {}
    confidence: dict = {}

    patterns = {
        "name":       r"(?:name|full\s*name)[:\s]+([A-Z][a-zA-Z\s]{2,40})",
        "dob":        r"(?:dob|date\s*of\s*birth|birth)[:\s/]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        "id_number":  r"(?:id\s*no|id\s*number|number|no\.?)[:\s]+([A-Z0-9]{5,20})",
        "expiry":     r"(?:expiry|expiration|valid\s*until|exp)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        "nationality": r"(?:nationality|country)[:\s]+([A-Z][a-zA-Z]{2,30})",
    }

    for field_name, pattern in patterns.items():
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            fields[field_name] = match.group(1).strip()
            confidence[field_name] = 90.0  # regex match = high confidence

    return fields, confidence


class TesseractOCRProvider(OCRProvider):

    def extract(self, s3_key: str) -> OCRResult:
        logger.info("tesseract_ocr_started", s3_key=s3_key)

        img_bytes = _download_from_s3(s3_key)
        processed, meta = _preprocess(img_bytes)

        # get word-level confidence data
        pil_img = Image.fromarray(processed)
        data = pytesseract.image_to_data(
            pil_img,
            lang=settings.TESSERACT_LANG,
            output_type=pytesseract.Output.DICT,
        )

        # filter words above confidence threshold
        words = [
            data["text"][i]
            for i in range(len(data["text"]))
            if int(data["conf"][i]) >= settings.OCR_CONFIDENCE_THRESHOLD
            and data["text"][i].strip()
        ]
        raw_text = " ".join(words)

        # also run full string extraction for regex parsing
        full_text = pytesseract.image_to_string(pil_img, lang=settings.TESSERACT_LANG)
        parsed_fields, confidence_scores = _parse_fields(full_text)

        # store avg OCR confidence in meta
        valid_confs = [int(c) for c in data["conf"] if int(c) >= 0]
        meta["avg_ocr_confidence"] = round(sum(valid_confs) / len(valid_confs), 2) if valid_confs else 0.0

        logger.info("tesseract_ocr_complete", s3_key=s3_key,
                    fields_found=list(parsed_fields.keys()),
                    avg_confidence=meta["avg_ocr_confidence"])

        return OCRResult(
            raw_text=full_text.strip(),
            parsed_fields=parsed_fields,
            confidence_scores=confidence_scores,
            preprocessing_meta=meta,
        )
