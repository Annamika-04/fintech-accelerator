import hashlib
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

s3_client = boto3.client(
    "s3",
    region_name=settings.AWS_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
)


def build_s3_key(user_id: str, document_type: str, filename: str) -> str:
    return f"users/{user_id}/documents/{document_type}/{filename}"


def build_selfie_s3_key(user_id: str, filename: str) -> str:
    return f"users/{user_id}/selfies/{filename}"


def generate_presigned_upload_url(
    user_id: str,
    document_type: str,
    filename: str,
    content_type: str,
) -> dict:
    s3_key = build_s3_key(user_id, document_type, filename)
    try:
        url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": s3_key,
                "ContentType": content_type,
                "ServerSideEncryption": "aws:kms",
            },
            ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRY,
        )
        logger.info("presigned_url_generated", user_id=user_id, s3_key=s3_key)
        return {"upload_url": url, "s3_key": s3_key}
    except ClientError as exc:
        logger.error("presigned_url_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to generate upload URL")


def generate_presigned_download_url(s3_key: str, expiry: int = 300) -> str:
    try:
        return s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": s3_key},
            ExpiresIn=expiry,
        )
    except ClientError as exc:
        raise HTTPException(status_code=500, detail=f"Download URL error: {exc}")


def compute_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def delete_s3_object(s3_key: str) -> None:
    try:
        s3_client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    except ClientError as exc:
        logger.warning("s3_delete_failed", s3_key=s3_key, error=str(exc))
