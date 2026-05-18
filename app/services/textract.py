import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

textract = boto3.client(
    "textract",
    region_name=settings.AWS_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
)


def extract_document_fields(s3_key: str) -> dict:
    try:
        response = textract.analyze_document(
            Document={"S3Object": {"Bucket": settings.S3_BUCKET_NAME, "Name": s3_key}},
            FeatureTypes=["FORMS", "TABLES"],
        )
    except ClientError as exc:
        logger.error("textract_failed", s3_key=s3_key, error=str(exc))
        raise HTTPException(status_code=500, detail=f"Textract error: {exc}")

    block_map = {b["Id"]: b for b in response.get("Blocks", [])}
    fields: dict = {}
    confidence_scores: dict = {}

    for block in block_map.values():
        if block["BlockType"] == "KEY_VALUE_SET" and "KEY" in block.get("EntityTypes", []):
            key_text = _get_text(block, block_map)
            confidence = block.get("Confidence", 0.0)
            val_text = ""
            for rel in block.get("Relationships", []):
                if rel["Type"] == "VALUE":
                    for val_id in rel["Ids"]:
                        val_block = block_map.get(val_id, {})
                        val_text = _get_text(val_block, block_map)
            if key_text:
                fields[key_text] = val_text
                confidence_scores[key_text] = round(confidence, 2)

    logger.info("textract_complete", s3_key=s3_key, field_count=len(fields))
    return {"fields": fields, "confidence_scores": confidence_scores}


def _get_text(block: dict, block_map: dict) -> str:
    words = []
    for rel in block.get("Relationships", []):
        if rel["Type"] == "CHILD":
            for child_id in rel["Ids"]:
                child = block_map.get(child_id, {})
                if child.get("BlockType") == "WORD":
                    words.append(child.get("Text", ""))
    return " ".join(words).strip()
