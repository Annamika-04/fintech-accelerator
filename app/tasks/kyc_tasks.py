import asyncio
from celery.exceptions import Retry
from app.tasks.celery_app import celery_app
from app.core.logging import get_logger

logger = get_logger(__name__)

LOCK_TTL = 120


def dispatch_kyc_validation_if_ready(user_id: str, source: str = "unknown") -> dict:
    """
    Enqueue final KYC validation only after OCR and face verification are complete.

    OCR and face tasks can finish in either order. This helper makes each task a
    harmless readiness signal instead of starting a retry loop while the other
    dependency is still running.
    """

    async def _readiness() -> dict:
        from sqlalchemy import select
        from app.db.session import task_db_session
        from app.models.document import Document, DocumentVerification
        from app.models.verification import FaceVerification
        from app.models.onboarding import OnboardingState, OnboardingStatus

        async with task_db_session() as db:
            state_res = await db.execute(
                select(OnboardingState).where(OnboardingState.user_id == user_id)
            )
            state = state_res.scalar_one_or_none()

            doc_res = await db.execute(
                select(DocumentVerification)
                .join(Document, Document.id == DocumentVerification.document_id)
                .where(Document.user_id == user_id)
                .order_by(DocumentVerification.created_at.desc())
            )
            doc_verification = doc_res.scalars().first()

            face_res = await db.execute(
                select(FaceVerification)
                .where(FaceVerification.user_id == user_id)
                .order_by(FaceVerification.created_at.desc())
            )
            face_record = face_res.scalars().first()

            allowed_statuses = {
                OnboardingStatus.KYC_PENDING,
                OnboardingStatus.DOCUMENTS_UPLOADED,
            }
            status_ok = bool(state and state.current_status in allowed_statuses)
            ocr_done = bool(doc_verification and doc_verification.verification_status == "completed")
            face_done = bool(face_record and face_record.status == "completed")

            return {
                "ready": status_ok and ocr_done and face_done,
                "current_status": state.current_status.value if state else None,
                "ocr_done": ocr_done,
                "face_done": face_done,
            }

    readiness = asyncio.run(_readiness())
    if not readiness["ready"]:
        logger.info(
            "kyc_validation_not_dispatched_not_ready",
            user_id=user_id,
            source=source,
            **readiness,
        )
        return {"status": "not_ready", **readiness}

    result = run_kyc_validation.apply_async(args=[user_id], queue="ai")
    logger.info(
        "kyc_validation_dispatched",
        user_id=user_id,
        source=source,
        task_id=result.id,
    )
    return {"status": "dispatched", "task_id": result.id, **readiness}


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="ai",
    name="tasks.run_kyc_validation",
)
def run_kyc_validation(self, user_id: str):
    """
    Run final KYC validation after OCR and face verification are complete.

    This task is intentionally not responsible for waiting on prerequisites.
    OCR and face tasks call dispatch_kyc_validation_if_ready after they commit
    their results, so the last completed dependency starts validation.
    """
    import redis as redis_lib
    from app.core.config import settings

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
                return {"status": "skipped", "reason": "wrong_status"}

            state.current_status = OnboardingStatus.KYC_PENDING
            await db.commit()

            doc_res = await db.execute(
                select(DocumentVerification)
                .join(Document, Document.id == DocumentVerification.document_id)
                .where(Document.user_id == user_id)
                .order_by(DocumentVerification.created_at.desc())
            )
            doc_verification = doc_res.scalars().first()

            face_res = await db.execute(
                select(FaceVerification)
                .where(FaceVerification.user_id == user_id)
                .order_by(FaceVerification.created_at.desc())
            )
            face_record = face_res.scalars().first()

            ocr_done = bool(doc_verification and doc_verification.verification_status == "completed")
            face_done = bool(face_record and face_record.status == "completed")

            if not ocr_done or not face_done:
                logger.info(
                    "kyc_validation_skipped_not_ready",
                    user_id=user_id,
                    ocr_done=ocr_done,
                    face_done=face_done,
                )
                return {"status": "not_ready", "ocr_done": ocr_done, "face_done": face_done}

            ocr_fields = doc_verification.extracted_fields or {}
            ocr_confidence = doc_verification.confidence_scores or {}
            raw_face_response = face_record.rekognition_response or {}

            face_result = {
                "is_match": face_record.is_match,
                "similarity_score": float(face_record.similarity_score or 0),
                "confidence_score": float(face_record.confidence_score or 0),
                "quality": face_record.image_quality
                or (raw_face_response.get("quality", {}) if isinstance(raw_face_response, dict) else {}),
            }

            profile_res = await db.execute(
                select(IndividualProfile).where(IndividualProfile.user_id == user_id)
            )
            profile = profile_res.scalar_one_or_none()

            validation = validate(
                ocr_fields={**ocr_fields, "confidence_scores": ocr_confidence},
                profile_name=profile.full_name if profile else "",
                profile_dob=profile.date_of_birth if profile else None,
                face_result=face_result,
            )

            new_status = (
                OnboardingStatus.AML_PENDING
                if validation["decision"] == "AML_PENDING"
                else OnboardingStatus(validation["decision"])
            )

            state.current_status = new_status
            state.kyc_score = validation["kyc_score"]
            state.kyc_metadata = {
                "confidence": validation["confidence"],
                "score_breakdown": validation["score_breakdown"],
                "review_reasons": validation["review_reasons"],
            }

            await db.commit()

            logger.info(
                "kyc_validation_state_advanced",
                user_id=user_id,
                new_status=new_status.value,
                kyc_score=validation["kyc_score"],
                review_reasons=validation["review_reasons"],
            )

            if new_status == OnboardingStatus.AML_PENDING and profile:
                run_aml_screening.apply_async(
                    args=[
                        user_id,
                        profile.full_name,
                        str(profile.date_of_birth) if profile.date_of_birth else None,
                        "individual",
                    ],
                    queue="aml",
                )
                logger.info("aml_screening_auto_triggered", user_id=user_id)
            elif new_status == OnboardingStatus.UNDER_REVIEW and profile:
                # Also trigger AML for manual review cases - compliance requirement
                # AML can run in parallel with manual KYC review
                run_aml_screening.apply_async(
                    args=[
                        user_id,
                        profile.full_name,
                        str(profile.date_of_birth) if profile.date_of_birth else None,
                        "individual",
                    ],
                    queue="aml",
                )
                logger.info("aml_screening_triggered_for_manual_review", user_id=user_id)

        return validation

    try:
        return asyncio.run(_run())
    except Retry:
        raise
    except Exception as exc:
        logger.error("kyc_validation_task_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)
    finally:
        r.delete(lock_key)
