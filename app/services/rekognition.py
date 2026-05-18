import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

rekognition = boto3.client(
    "rekognition",
    region_name=settings.AWS_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
)


def compare_faces(selfie_s3_key: str, id_s3_key: str) -> dict:
    try:
        response = rekognition.compare_faces(
            SourceImage={"S3Object": {"Bucket": settings.S3_BUCKET_NAME, "Name": selfie_s3_key}},
            TargetImage={"S3Object": {"Bucket": settings.S3_BUCKET_NAME, "Name": id_s3_key}},
            SimilarityThreshold=settings.FACE_SIMILARITY_THRESHOLD,
        )
    except ClientError as exc:
        logger.error("rekognition_failed", error=str(exc))
        raise HTTPException(status_code=500, detail=f"Rekognition error: {exc}")

    matches = response.get("FaceMatches", [])
    if not matches:
        logger.info("face_no_match", selfie=selfie_s3_key, id_doc=id_s3_key)
        return {
            "is_match": False,
            "similarity_score": 0.0,
            "confidence_score": 0.0,
            "raw_response": response,
        }

    best = max(matches, key=lambda x: x["Similarity"])
    similarity = round(best["Similarity"], 2)
    confidence = round(best["Face"]["Confidence"], 2)
    is_match = (
        similarity >= settings.FACE_SIMILARITY_THRESHOLD
        and confidence >= settings.FACE_CONFIDENCE_THRESHOLD
    )

    logger.info(
        "face_comparison_done",
        similarity=similarity,
        confidence=confidence,
        is_match=is_match,
    )
    return {
        "is_match": is_match,
        "similarity_score": similarity,
        "confidence_score": confidence,
        "raw_response": response,
    }
