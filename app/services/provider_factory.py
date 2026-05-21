from app.core.config import settings
from app.services.base import OCRProvider, FaceVerificationProvider


def get_ocr_provider() -> OCRProvider:
    if settings.OCR_PROVIDER == "tesseract":
        from app.services.tesseract_service import TesseractOCRProvider
        return TesseractOCRProvider()
    if settings.OCR_PROVIDER == "textract":
        from app.services.textract import TextractOCRProvider
        return TextractOCRProvider()
    raise ValueError(f"Unknown OCR_PROVIDER: '{settings.OCR_PROVIDER}'. Use 'tesseract' or 'textract'.")


def get_face_provider() -> FaceVerificationProvider:
    if settings.FACE_PROVIDER == "deepface":
        from app.services.deepface_service import DeepFaceProvider
        return DeepFaceProvider()
    if settings.FACE_PROVIDER == "rekognition":
        from app.services.rekognition import RekognitionFaceProvider
        return RekognitionFaceProvider()
    raise ValueError(f"Unknown FACE_PROVIDER: '{settings.FACE_PROVIDER}'. Use 'deepface' or 'rekognition'.")
