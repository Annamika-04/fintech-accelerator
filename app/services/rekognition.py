import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import get_logger
from app.services.base import FaceVerificationProvider, FaceResult

logger = get_logger(__name__)


class RekognitionFaceProvider(FaceVerificationProvider):

    def __init__(self):
        self._client = boto3.client(
            "rekognition",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
            aws_session_token=settings.AWS_SESSION_TOKEN or None,
        )

    def verify(self, selfie_s3_key: str, id_document_s3_key: str) -> FaceResult:
        logger.info("rekognition_verify_started", selfie=selfie_s3_key, id_doc=id_document_s3_key)
        try:
            response = self._client.compare_faces(
                SourceImage={"S3Object": {"Bucket": settings.S3_BUCKET_NAME, "Name": selfie_s3_key}},
                TargetImage={"S3Object": {"Bucket": settings.S3_BUCKET_NAME, "Name": id_document_s3_key}},
                SimilarityThreshold=settings.FACE_SIMILARITY_THRESHOLD,
            )
        except ClientError as exc:
            logger.error("rekognition_failed", error=str(exc))
            raise HTTPException(status_code=500, detail=f"Rekognition error: {exc}")

        matches = response.get("FaceMatches", [])
        if not matches:
            logger.info("rekognition_no_match", selfie=selfie_s3_key)
            return FaceResult(is_match=False, similarity_score=0.0, confidence_score=0.0,
                              raw_response=response)

        best = max(matches, key=lambda x: x["Similarity"])
        similarity = round(best["Similarity"] / 100, 4)   # normalise to 0-1 to match DeepFace
        confidence = round(best["Face"]["Confidence"] / 100, 4)
        is_match = (
            best["Similarity"] >= settings.FACE_SIMILARITY_THRESHOLD
            and best["Face"]["Confidence"] >= settings.FACE_CONFIDENCE_THRESHOLD
        )

        logger.info("rekognition_verify_complete", similarity=similarity, is_match=is_match)
        return FaceResult(
            is_match=is_match,
            similarity_score=similarity,
            confidence_score=confidence,
            raw_response=response,
        )


# keep legacy function for any direct callers
def compare_faces(selfie_s3_key: str, id_s3_key: str) -> dict:
    result = RekognitionFaceProvider().verify(selfie_s3_key, id_s3_key)
    return {
        "is_match": result.is_match,
        "similarity_score": result.similarity_score,
        "confidence_score": result.confidence_score,
        "raw_response": result.raw_response,
    }
