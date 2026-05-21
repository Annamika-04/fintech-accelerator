import os
import tempfile

import boto3
from deepface import DeepFace

from app.core.config import settings
from app.core.logging import get_logger
from app.services.base import FaceVerificationProvider, FaceResult

logger = get_logger(__name__)


def _download_to_tempfile(s3_key: str, suffix: str = ".jpg") -> str:
    """Download S3 object to a temp file, return the file path."""
    s3 = boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        aws_session_token=settings.AWS_SESSION_TOKEN or None,
    )
    obj = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    data = obj["Body"].read()

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.close()
    return tmp.name


class DeepFaceProvider(FaceVerificationProvider):

    def verify(self, selfie_s3_key: str, id_document_s3_key: str) -> FaceResult:
        logger.info("deepface_verify_started",
                    selfie=selfie_s3_key, id_doc=id_document_s3_key)

        selfie_path = id_path = None
        try:
            selfie_path = _download_to_tempfile(selfie_s3_key)
            id_path = _download_to_tempfile(id_document_s3_key)

            result = DeepFace.verify(
                img1_path=selfie_path,
                img2_path=id_path,
                model_name=settings.DEEPFACE_MODEL,
                detector_backend=settings.DEEPFACE_DETECTOR,
                distance_metric=settings.DEEPFACE_DISTANCE_METRIC,
                enforce_detection=True,
            )

            distance = float(result.get("distance", 1.0))
            is_match = distance <= settings.DEEPFACE_THRESHOLD
            # normalise distance → similarity score (0.0–1.0, higher = more similar)
            similarity = round(max(0.0, 1.0 - distance), 4)
            confidence = round(float(result.get("facial_areas", {}).get("img1", {}).get("confidence", 0.0) or 0.0), 2)

            logger.info("deepface_verify_complete",
                        distance=distance, is_match=is_match, similarity=similarity)

            return FaceResult(
                is_match=is_match,
                similarity_score=similarity,
                confidence_score=confidence,
                raw_response={
                    "distance": distance,
                    "threshold": settings.DEEPFACE_THRESHOLD,
                    "model": settings.DEEPFACE_MODEL,
                    "detector": settings.DEEPFACE_DETECTOR,
                    "verified": result.get("verified"),
                },
            )

        except ValueError as exc:
            # DeepFace raises ValueError when no face is detected
            logger.warning("deepface_no_face_detected", error=str(exc))
            return FaceResult(
                is_match=False,
                similarity_score=0.0,
                confidence_score=0.0,
                raw_response={"error": str(exc), "model": settings.DEEPFACE_MODEL},
            )

        finally:
            for path in (selfie_path, id_path):
                if path and os.path.exists(path):
                    os.unlink(path)
