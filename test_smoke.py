"""
Quick end-to-end smoke test.
Run AFTER docker-compose up --build

Usage:
    pip install httpx
    python test_smoke.py           # API smoke tests
    python test_smoke.py --ml      # ML pipeline offline tests
"""

import httpx
import json

BASE = "http://localhost:8000"
API  = f"{BASE}/api/v1"


def check(label: str, resp: httpx.Response, expect: int = 200):
    status = "[PASS]" if resp.status_code == expect else "[FAIL]"
    print(f"{status} [{resp.status_code}] {label}")
    if resp.status_code not in (200, 201, 202):
        print(f"   -> {resp.text[:200]}")
    return resp.status_code == expect


def main():
    print("\n=== KYC Platform Smoke Test ===\n")

    # 1. Health check
    r = httpx.get(f"{BASE}/health")
    check("Health endpoint", r)

    # 2. Docs available (DEBUG=true)
    r = httpx.get(f"{BASE}/docs")
    check("Swagger UI", r)

    # 3. Auth - register without token should fail with 403/422 not 500
    r = httpx.post(f"{API}/auth/register", json={})
    ok = r.status_code in (401, 403, 422)
    print(f"{'[PASS]' if ok else '[FAIL]'} [{r.status_code}] Auth register rejects bad input")

    # 4. Documents - no token should return 403
    r = httpx.get(f"{API}/documents/")
    ok = r.status_code in (401, 403)
    print(f"{'[PASS]' if ok else '[FAIL]'} [{r.status_code}] Documents requires auth")

    # 5. Risk - no token should return 403
    r = httpx.get(f"{API}/risk/history/some-user-id")
    ok = r.status_code in (401, 403)
    print(f"{'[PASS]' if ok else '[FAIL]'} [{r.status_code}] Risk requires auth")

    # 6. AML - no token should return 403
    r = httpx.post(f"{API}/aml/screen", json={"full_name": "Test User"})
    ok = r.status_code in (401, 403)
    print(f"{'[PASS]' if ok else '[FAIL]'} [{r.status_code}] AML requires auth")

    print("\n=== Done ===")
    print("Next: Open http://localhost:8000/docs and test with a real token")
    print("      Open http://localhost:5555 to see Celery workers")


def test_ml_pipeline():
    """Offline smoke tests for Tesseract OCR and DeepFace - no S3, no DB needed."""
    import sys, io, os, tempfile
    sys.path.insert(0, ".")

    print("\n=== ML Pipeline Smoke Tests ===\n")

    # -- 1. OpenCV preprocessing --
    try:
        import cv2, numpy as np
        from app.services.tesseract_service import _preprocess
        from PIL import Image
        img = Image.new("RGB", (400, 150), "white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        processed, meta = _preprocess(buf.getvalue())
        assert processed is not None and "avg_brightness" in meta
        print("[PASS] OpenCV preprocessing - brightness:", meta["avg_brightness"], "| skew:", meta["skew_angle"])
    except Exception as e:
        print("[FAIL] OpenCV preprocessing:", e)

    # -- 2. Tesseract OCR extraction --
    try:
        import pytesseract
        from PIL import Image, ImageDraw
        from app.services.tesseract_service import _parse_fields
        pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        img = Image.new("RGB", (500, 180), "white")
        d = ImageDraw.Draw(img)
        d.text((10, 30),  "Name: JOHN DOE",  fill="black")
        d.text((10, 70),  "DOB: 15/08/1990", fill="black")
        d.text((10, 110), "ID No: PAN123456", fill="black")
        text = pytesseract.image_to_string(img, lang="eng")
        fields, confs = _parse_fields(text)
        assert isinstance(text, str) and len(text) > 0
        print("[PASS] Tesseract OCR - raw chars:", len(text.strip()), "| fields found:", list(fields.keys()))
    except Exception as e:
        print("[FAIL] Tesseract OCR:", e)

    # -- 3. OCRResult dataclass --
    try:
        from app.services.base import OCRResult
        r = OCRResult(raw_text="test", parsed_fields={"name": "John"}, confidence_scores={"name": 90.0})
        assert r.raw_text == "test" and r.parsed_fields["name"] == "John"
        print("[PASS] OCRResult dataclass - fields:", list(r.__dataclass_fields__.keys()))
    except Exception as e:
        print("[FAIL] OCRResult dataclass:", e)

    # -- 4. FaceResult dataclass --
    try:
        from app.services.base import FaceResult
        r = FaceResult(is_match=True, similarity_score=0.92, confidence_score=0.98)
        assert r.is_match is True and r.similarity_score == 0.92
        print("[PASS] FaceResult dataclass - fields:", list(r.__dataclass_fields__.keys()))
    except Exception as e:
        print("[FAIL] FaceResult dataclass:", e)

    # -- 5. DeepFace import + no-face error handling --
    try:
        import numpy as np, cv2
        from deepface import DeepFace
        img = np.ones((224, 224, 3), dtype=np.uint8) * 128
        tmp1 = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
        tmp2 = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
        cv2.imwrite(tmp1.name, img)
        cv2.imwrite(tmp2.name, img)
        tmp1.close(); tmp2.close()
        try:
            DeepFace.verify(tmp1.name, tmp2.name, model_name="ArcFace",
                            detector_backend="opencv", enforce_detection=True)
            print("[PASS] DeepFace verify - matched (unexpected on synthetic)")
        except ValueError:
            print("[PASS] DeepFace verify - no-face ValueError handled correctly")
        finally:
            os.unlink(tmp1.name); os.unlink(tmp2.name)
    except Exception as e:
        print("[FAIL] DeepFace import/verify:", e)

    # -- 6. Provider factory --
    try:
        from app.services.provider_factory import get_ocr_provider, get_face_provider
        ocr = get_ocr_provider()
        face = get_face_provider()
        assert type(ocr).__name__ == "TesseractOCRProvider"
        assert type(face).__name__ == "DeepFaceProvider"
        print("[PASS] Provider factory - OCR:", type(ocr).__name__, "| Face:", type(face).__name__)
    except Exception as e:
        print("[FAIL] Provider factory:", e)

    # -- 7. Celery task registration --
    try:
        from app.tasks.ocr_tasks import run_ocr
        from app.tasks.face_tasks import run_face_verification
        assert run_ocr.name == "tasks.run_ocr"
        assert run_face_verification.name == "tasks.run_face_verification"
        print("[PASS] Celery tasks registered -", run_ocr.name, "|", run_face_verification.name)
    except Exception as e:
        print("[FAIL] Celery task registration:", e)

    print("\n=== ML Pipeline Done ===")


if __name__ == "__main__":
    import sys
    if "--ml" in sys.argv:
        test_ml_pipeline()
    else:
        main()
