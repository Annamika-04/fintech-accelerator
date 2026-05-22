import asyncio
from celery.exceptions import Retry
from app.tasks.celery_app import celery_app
from app.core.logging import get_logger

logger = get_logger(__name__)

LOCK_TTL = 120  # seconds — lock expires after 2 minutes


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="ai",
    name="tasks.run_kyc_validation",
)
def run_kyc_validation(self, user_id: str):
    """
    Orchestration task — runs after OCR + face tasks both complete.
    Uses Redis lock to prevent duplicate runs (race condition between OCR + face tasks).
    Stores full confidence metadata and review reasons.
    """
    import redis as redis_lib
    from app.core.config import settings

    # ── Redis lock — only one validation runs per user at a time ─────────────
    lock_key = f"kyc_validation_lock:{user_id}"
    r = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)

    acquired = r.set(lock_key, "1", nx=True, ex=LOCK_TTL)
    if not acquired:
        logger.info("kyc_validation_skipped_lock_held", user_id=user_id)
        return {"status": "skipped", "reason": "lock_held"}

    logger.info("kyc_validation_started", user_id=user_id)

    async def _run():
        from sqlalchemy import select
        from app.db.session import task_db_session
        from app.models.document import Document, DocumentVerification
        from app.models.verification import FaceVerification
        from app.models.onboarding import OnboardingState, OnboardingStatus, IndividualProfile
        from app.services.kyc_validation import run_kyc_validation as validate
        from app.tasks.aml_tasks import run_aml_screening

        async with task_db_session() as db:

            # ── Status guard — only run if still KYC_PENDING ─────────────────
            state_res = await db.execute(
                select(OnboardingState).where(OnboardingState.user_id == user_id)
            )
            state = state_res.scalar_one_or_none()

            if not state or state.current_status not in (
                OnboardingStatus.KYC_PENDING,
                OnboardingStatus.DOCUMENTS_UPLOADED,
            ):
                logger.info(
                    "kyc_validation_skipped_wrong_status",
                    user_id=user_id,
                    status=state.current_status.value if state else "none",
                )
                r.delete(lock_key)
                return {"status": "skipped", "reason": "wrong_status"}

            # Mark as running immediately to prevent re-entry
            state.current_status = OnboardingStatus.KYC_PENDING
            await db.commit()

            # ── Load OCR result ───────────────────────────────────────────────
            doc_res = await db.execute(
                select(DocumentVerification)
                .join(Document, Document.id == DocumentVerification.document_id)
                .where(Document.user_id == user_id)
                .order_by(DocumentVerification.created_at.desc())
            )
            doc_verification = doc_res.scalars().first()

            # ── Load face result ──────────────────────────────────────────────
            face_res = await db.execute(
                select(FaceVerification)
                .where(FaceVerification.user_id == user_id)
                .order_by(FaceVerification.created_at.desc())
            )
            face_record = face_res.scalars().first()

            ocr_done  = doc_verification and doc_verification.verification_status == "completed"
            face_done = face_record and face_record.status == "completed"

            if not ocr_done or not face_done:
                # Revert status and release lock — retry later
                state.current_status = OnboardingStatus.DOCUMENTS_UPLOADED
                await db.commit()
                r.delete(lock_key)
                logger.info(
                    "kyc_validation_waiting",
                    user_id=user_id,
                    ocr_done=ocr_done,
                    face_done=face_done,
                )
                raise self.retry(countdown=30)

            # ── Build inputs ──────────────────────────────────────────────────
            ocr_fields = doc_verification.extracted_fields or {}
            ocr_confidence = doc_verification.confidence_scores or {}

            face_result = {
                "is_match": face_record.is_match,
                "similarity_score": float(face_record.similarity_score or 0),
                "confidence_score": float(face_record.confidence_score or 0),
                "quality": face_record.rekognition_response.get("quality", {})
                if isinstance(face_record.rekognition_response, dict) else {},
            }

            # ── Load profile ──────────────────────────────────────────────────
            profile_res = await db.execute(
                select(IndividualProfile).where(IndividualProfile.user_id == user_id)
            )
            profile = profile_res.scalar_one_or_none()

            # ── Run validation engine ─────────────────────────────────────────
            validation = validate(
                ocr_fields={**ocr_fields, "confidence_scores": ocr_confidence},
                profile_name=profile.full_name if profile else "",
                profile_dob=profile.date_of_birth if profile else None,
                face_result=face_result,
            )

            # ── Advance state + store full metadata ───────────────────────────
            new_status = (
                OnboardingStatus.AML_PENDING
                if validation["decision"] == "AML_PENDING"
                else OnboardingStatus(validation["decision"])
            )

            state.current_status = new_status
            state.kyc_score = validation["kyc_score"]

            # Store confidence scores, review reasons, score breakdown
            state.kyc_metadata = {
                "confidence":      validation["confidence"],
                "score_breakdown": validation["score_breakdown"],
                "review_reasons":  validation["review_reasons"],
            }

            await db.commit()

            logger.info(
                "kyc_validation_state_advanced",
                user_id=user_id,
                new_status=new_status.value,
                kyc_score=validation["kyc_score"],
                review_reasons=validation["review_reasons"],
            )

            # ── Auto-trigger AML if passed ────────────────────────────────────
            if new_status == OnboardingStatus.AML_PENDING and profile:
                run_aml_screening.delay(
                    user_id,
                    profile.full_name,
                    str(profile.date_of_birth) if profile.date_of_birth else None,
                    "individual",
                )
                logger.info("aml_screening_auto_triggered", user_id=user_id)

        return validation

    try:
        result = asyncio.run(_run())
        return result
    except Retry:
        raise
    except Exception as exc:
        logger.error("kyc_validation_task_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)
    finally:
        r.delete(lock_key)
