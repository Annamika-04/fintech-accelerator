from app.tasks.celery_app import celery_app
from app.services.face_service import compare_faces
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="face",
    name="tasks.run_face_verification",
)
def run_face_verification(
    self,
    face_verification_id: str,
    selfie_s3_key: str,
    id_document_s3_key: str,
    user_id: str,
):
    """Compare selfie against ID document using DeepFace, then trigger KYC validation."""
    import asyncio
    from app.tasks.kyc_tasks import dispatch_kyc_validation_if_ready

    logger.info("face_task_started", face_verification_id=face_verification_id)

    try:
        result = compare_faces(selfie_s3_key, id_document_s3_key)

        async def _save():
            from app.db.session import task_db_session
            from app.models.verification import FaceVerification
            from sqlalchemy import select

            async with task_db_session() as db:
                res = await db.execute(
                    select(FaceVerification).where(
                        FaceVerification.id == face_verification_id
                    )
                )
                record = res.scalar_one_or_none()
                if record:
                    record.similarity_score = result["similarity_score"]
                    record.confidence_score = result["confidence_score"]
                    record.is_match = result["is_match"]
                    record.rekognition_response = result["raw_response"]
                    record.image_quality = result.get("quality", {})
                    record.status = "completed"
                    await db.commit()

        asyncio.run(_save())
        logger.info("face_task_complete", face_verification_id=face_verification_id)

        # Trigger KYC validation — it will wait for OCR task too
        dispatch_kyc_validation_if_ready(user_id, source="face")

        return {"status": "success", "is_match": result["is_match"]}

    except Exception as exc:
        logger.error("face_task_failed", face_verification_id=face_verification_id, error=str(exc))
        if self.request.retries >= self.max_retries:
            async def _mark_failed():
                from sqlalchemy import select
                from app.db.session import task_db_session
                from app.models.verification import FaceVerification

                async with task_db_session() as db:
                    res = await db.execute(
                        select(FaceVerification).where(
                            FaceVerification.id == face_verification_id
                        )
                    )
                    record = res.scalar_one_or_none()
                    if record:
                        record.status = "failed"
                        record.rekognition_response = {"error": str(exc)}
                        await db.commit()

            asyncio.run(_mark_failed())
        raise self.retry(exc=exc)
