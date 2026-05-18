from app.tasks.celery_app import celery_app
from app.services.groq_ai import generate_kyc_summary
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=15,
    queue="ai",
    name="tasks.generate_ai_summary",
)
def generate_ai_summary(
    self,
    user_id: str,
    extracted_fields: dict,
    risk_score: int,
    decision: str,
):
    """Generate an AI-powered KYC compliance summary via Groq."""
    logger.info("ai_summary_task_started", user_id=user_id)
    try:
        summary = generate_kyc_summary(extracted_fields, risk_score, decision)
        logger.info("ai_summary_task_complete", user_id=user_id)
        return {"status": "success", "summary": summary}
    except Exception as exc:
        logger.error("ai_summary_task_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)
