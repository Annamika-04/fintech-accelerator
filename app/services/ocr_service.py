import io
import re
import boto3
from botocore.exceptions import ClientError
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ── AWS Textract (primary) ────────────────────────────────────────────────────

def _textract_extract(s3_key: str) -> dict:
    textract = boto3.client(
        "textract",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )
    response = textract.analyze_document(
        Document={"S3Object": {"Bucket": settings.S3_BUCKET_NAME, "Name": s3_key}},
        FeatureTypes=["FORMS", "TABLES"],
    )
    block_map = {b["Id"]: b for b in response.get("Blocks", [])}
    fields: dict = {}
    confidence_scores: dict = {}

    for block in block_map.values():
        if block["BlockType"] == "KEY_VALUE_SET" and "KEY" in block.get("EntityTypes", []):
            key_text = _get_text_textract(block, block_map)
            confidence = block.get("Confidence", 0.0)
            val_text = ""
            for rel in block.get("Relationships", []):
                if rel["Type"] == "VALUE":
                    for val_id in rel["Ids"]:
                        val_block = block_map.get(val_id, {})
                        val_text = _get_text_textract(val_block, block_map)
            if key_text:
                fields[key_text] = val_text
                confidence_scores[key_text] = round(confidence, 2)

    return {"fields": fields, "confidence_scores": confidence_scores}


def _get_text_textract(block: dict, block_map: dict) -> str:
    words = []
    for rel in block.get("Relationships", []):
        if rel["Type"] == "CHILD":
            for child_id in rel["Ids"]:
                child = block_map.get(child_id, {})
                if child.get("BlockType") == "WORD":
                    words.append(child.get("Text", ""))
    return " ".join(words).strip()


# ── Tesseract fallback (local) ────────────────────────────────────────────────

def _tesseract_extract(s3_key: str) -> dict:
    import cv2
    import numpy as np
    import pytesseract
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

    # Preprocess for better OCR
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 11, 17, 17)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    raw_text = pytesseract.image_to_string(thresh, config="--psm 6")
    fields = _parse_ocr_text(raw_text)

    # Estimate confidence via pytesseract data
    data = pytesseract.image_to_data(thresh, output_type=pytesseract.Output.DICT)
    confs = [int(c) for c in data["conf"] if str(c).lstrip("-").isdigit() and int(c) > 0]
    avg_conf = round(sum(confs) / len(confs), 2) if confs else 0.0

    confidence_scores = {k: avg_conf for k in fields}
    return {"fields": fields, "confidence_scores": confidence_scores}


def _parse_ocr_text(text: str) -> dict:
    fields: dict = {}
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Name — look for "Name:", "Surname:", "Given Name:" patterns
    for line in lines:
        m = re.search(r"(?:name|surname|given\s*name)[:\s]+([A-Za-z\s]+)", line, re.I)
        if m:
            fields["name"] = m.group(1).strip()
            break

    # DOB — common date patterns
    for line in lines:
        m = re.search(r"(?:dob|date\s*of\s*birth|birth\s*date)[:\s]*([\d]{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4})", line, re.I)
        if m:
            fields["date_of_birth"] = m.group(1).strip()
            break
    if "date_of_birth" not in fields:
        for line in lines:
            m = re.search(r"\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b", line)
            if m:
                fields["date_of_birth"] = m.group(1).strip()
                break

    # Document number — passport/ID patterns
    for line in lines:
        m = re.search(r"(?:passport\s*no|document\s*no|id\s*no|number)[:\s]*([A-Z0-9]{6,12})", line, re.I)
        if m:
            fields["document_number"] = m.group(1).strip()
            break
    if "document_number" not in fields:
        for line in lines:
            m = re.search(r"\b([A-Z]{1,2}[0-9]{6,8})\b", line)
            if m:
                fields["document_number"] = m.group(1).strip()
                break

    # Nationality
    for line in lines:
        m = re.search(r"(?:nationality|citizenship)[:\s]+([A-Za-z\s]+)", line, re.I)
        if m:
            fields["nationality"] = m.group(1).strip()
            break

    fields["raw_text"] = "\n".join(lines[:30])
    return fields


# ── Public interface ──────────────────────────────────────────────────────────

def extract_document_fields(s3_key: str) -> dict:
    """Try Textract first, fall back to Tesseract+OpenCV if unavailable."""
    try:
        result = _textract_extract(s3_key)
        logger.info("ocr_via_textract", s3_key=s3_key, field_count=len(result["fields"]))
        return result
    except Exception as exc:
        logger.warning("textract_unavailable_falling_back", error=str(exc))

    try:
        result = _tesseract_extract(s3_key)
        logger.info("ocr_via_tesseract", s3_key=s3_key, field_count=len(result["fields"]))
        return result
    except Exception as exc:
        logger.error("ocr_all_methods_failed", s3_key=s3_key, error=str(exc))
        return {"fields": {}, "confidence_scores": {}}
