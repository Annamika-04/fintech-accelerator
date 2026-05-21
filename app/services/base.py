from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class OCRResult:
    raw_text: str
    parsed_fields: dict                  # name, dob, id_number, etc.
    confidence_scores: dict              # per-field Tesseract confidence (0-100)
    preprocessing_meta: dict = field(default_factory=dict)  # brightness, skew, etc.


@dataclass
class FaceResult:
    is_match: bool
    similarity_score: float              # 0.0 – 1.0 (cosine) or 0–100 (rekognition)
    confidence_score: float              # detector confidence
    raw_response: dict = field(default_factory=dict)


class OCRProvider(ABC):
    @abstractmethod
    def extract(self, s3_key: str) -> OCRResult:
        """Download image from S3, run OCR, return structured result."""


class FaceVerificationProvider(ABC):
    @abstractmethod
    def verify(self, selfie_s3_key: str, id_document_s3_key: str) -> FaceResult:
        """Download both images from S3, compare faces, return result."""
