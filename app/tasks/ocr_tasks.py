from celery import shared_task
from sqlalchemy import select
from app.tasks.celery_app import celery_app
from app.services.textract import extract_document_fields
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
    """Extract text fields from a document using AWS Textract."""
    from app.db.session import AsyncSessionLocal
    from app.models.document import DocumentVerification
    import asyncio

    logger.info("ocr_task_started", document_id=document_id, s3_key=s3_key)

    try:
        result = extract_document_fields(s3_key)

        async def _save():
            async with AsyncSessionLocal() as db:
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
        return {"status": "success", "document_id": document_id}

    except Exception as exc:
        logger.error("ocr_task_failed", document_id=document_id, error=str(exc))
        raise self.retry(exc=exc)
