import asyncio
from celery.exceptions import Retry
from app.tasks.celery_app import celery_app
from app.services.ocr_service import extract_document_fields
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="ocr",
    name="tasks.run_ocr",
)
def run_ocr(self, document_id: str, s3_key: str, user_id: str):
    """Extract text fields from a document, then trigger KYC validation."""
    from app.tasks.kyc_tasks import run_kyc_validation

    logger.info("ocr_task_started", document_id=document_id, s3_key=s3_key)

    try:
        result = extract_document_fields(s3_key)

        async def _save():
            from app.db.session import task_db_session
            from app.models.document import DocumentVerification

            async with task_db_session() as db:
                verification = DocumentVerification(
                    document_id=document_id,
                    user_id=user_id,
                    extracted_fields=result["fields"],
                    confidence_scores=result["confidence_scores"],
                    verification_status="completed",
                )
                db.add(verification)
                await db.commit()

        asyncio.run(_save())
        logger.info("ocr_task_complete", document_id=document_id)

        # Trigger KYC validation — it will wait for face task too
        logger.info("dispatching_kyc_validation", user_id=user_id)
        run_kyc_validation.delay(user_id)

        return {"status": "success", "document_id": document_id}

    except Retry:
        raise
    except Exception as exc:
        logger.error("ocr_task_failed", document_id=document_id, error=str(exc))
        raise self.retry(exc=exc)
