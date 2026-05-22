import io
import cv2
import numpy as np
import boto3
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _download_image(s3_key: str) -> np.ndarray:
    s3 = boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )
    obj = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    arr = np.frombuffer(obj["Body"].read(), np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def _crop_face(img: np.ndarray) -> np.ndarray:
    """Detect and crop the largest face from an image."""
    from deepface import DeepFace
    try:
        faces = DeepFace.extract_faces(img, detector_backend="opencv", enforce_detection=True)
        if faces:
            region = faces[0]["facial_area"]
            x, y, w, h = region["x"], region["y"], region["w"], region["h"]
            # Add 10% padding
            pad_x = int(w * 0.1)
            pad_y = int(h * 0.1)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(img.shape[1], x + w + pad_x)
            y2 = min(img.shape[0], y + h + pad_y)
            return img[y1:y2, x1:x2]
    except Exception:
        pass
    return img


def _check_image_quality(img: np.ndarray) -> dict:
    """Check blur and brightness of image."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    brightness = gray.mean()
    return {
        "blur_score": round(float(blur_score), 2),
        "brightness": round(float(brightness), 2),
        "is_blurry": bool(blur_score < 80),
        "poor_lighting": bool(brightness < 50 or brightness > 220),
    }


def compare_faces(selfie_s3_key: str, id_document_s3_key: str) -> dict:
    """Compare selfie against ID document face using DeepFace."""
    from deepface import DeepFace

    logger.info("face_comparison_started", selfie=selfie_s3_key, id_doc=id_document_s3_key)

    selfie_img = _download_image(selfie_s3_key)
    id_img = _download_image(id_document_s3_key)

    quality = _check_image_quality(selfie_img)

    # Crop face from ID document before comparison
    id_face = _crop_face(id_img)

    try:
        result = DeepFace.verify(
            img1_path=selfie_img,
            img2_path=id_face,
            model_name="Facenet512",
            detector_backend="opencv",
            enforce_detection=True,
        )
        similarity_score = round((1 - result["distance"]) * 100, 2)
        is_match = result["verified"]
        confidence_score = round(result.get("threshold", 0.4) * 100, 2)

    except Exception as exc:
        logger.warning("deepface_strict_failed_retrying", error=str(exc))
        # Retry without enforcing face detection
        try:
            result = DeepFace.verify(
                img1_path=selfie_img,
                img2_path=id_face,
                model_name="Facenet512",
                detector_backend="opencv",
                enforce_detection=False,
            )
            similarity_score = round((1 - result["distance"]) * 100, 2)
            is_match = result["verified"]
            confidence_score = round(result.get("threshold", 0.4) * 100, 2)
        except Exception as exc2:
            logger.error("face_comparison_failed", error=str(exc2))
            return {
                "is_match": False,
                "similarity_score": 0.0,
                "confidence_score": 0.0,
                "quality": quality,
                "raw_response": {"error": str(exc2)},
            }

    logger.info("face_comparison_done", similarity=similarity_score, is_match=is_match)
    return {
        "is_match": is_match,
        "similarity_score": similarity_score,
        "confidence_score": confidence_score,
        "quality": quality,
        "raw_response": result,
    }
