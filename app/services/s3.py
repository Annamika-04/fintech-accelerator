import hashlib
import io
import uuid
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

s3_client = boto3.client(
    "s3",
    region_name=settings.AWS_REGION,
    endpoint_url=f"https://s3.{settings.AWS_REGION}.amazonaws.com",
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    aws_session_token=settings.AWS_SESSION_TOKEN or None,
    config=Config(signature_version="s3v4"),
)


def build_s3_key(
    tenant_id: str,
    user_id: str,
    onboarding_id: str,
    document_type: str,
    document_id: str,
    filename: str,
    *,
    version: int = 1,
) -> str:
    return (
        f"tenants/{tenant_id}/subjects/{user_id}/onboarding/{onboarding_id}/"
        f"{document_type}/{document_id}/v{version}/{filename}"
    )


def build_selfie_s3_key(tenant_id: str, user_id: str, onboarding_id: str, filename: str, *, version: int = 1) -> str:
    return (
        f"tenants/{tenant_id}/subjects/{user_id}/onboarding/{onboarding_id}/"
        f"selfie/{uuid.uuid4()}/v{version}/{filename}"
    )


def build_s3_url(bucket: str, s3_key: str) -> str:
    return f"s3://{bucket}/{s3_key}"


def generate_presigned_upload_url(
    tenant_id: str,
    user_id: str,
    onboarding_id: str,
    document_type: str,
    document_id: str,
    filename: str,
    content_type: str,
    *,
    version: int = 1,
) -> dict:
    s3_key = build_s3_key(tenant_id, user_id, onboarding_id, document_type, document_id, filename, version=version)
    upload_headers = {
        "Content-Type": content_type,
    }
    try:
        url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": s3_key,
                "ContentType": content_type,
            },
            ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRY,
        )
        logger.info(
            "presigned_url_generated",
            user_id=user_id,
            s3_key=s3_key,
            bucket=settings.S3_BUCKET_NAME,
            region=settings.AWS_REGION,
            url_host=url.split("?", 1)[0],
        )
        return {"upload_url": url, "s3_key": s3_key, "upload_headers": upload_headers}
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


def upload_bytes_to_s3(file_bytes: bytes, s3_key: str, content_type: str) -> None:
    try:
        s3_client.upload_fileobj(
            io.BytesIO(file_bytes),
            settings.S3_BUCKET_NAME,
            s3_key,
            ExtraArgs={"ContentType": content_type},
        )
    except ClientError as exc:
        error_payload = exc.response.get("Error", {}) if getattr(exc, "response", None) else {}
        error_code = error_payload.get("Code", "UnknownS3Error")
        error_message = error_payload.get("Message", str(exc))
        logger.error(
            "s3_upload_failed",
            s3_key=s3_key,
            bucket=settings.S3_BUCKET_NAME,
            region=settings.AWS_REGION,
            error_code=error_code,
            error_message=error_message,
        )
        raise HTTPException(status_code=502, detail=f"S3 upload failed: {error_code} - {error_message}")
