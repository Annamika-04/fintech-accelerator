import asyncio
from app.tasks.celery_app import celery_app
from app.services.aml_screening import screen_entity
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="aml",
    name="tasks.run_aml_screening",
)
def run_aml_screening(
    self,
    user_id: str,
    full_name: str,
    date_of_birth: str | None = None,
    profile_type: str = "individual",
):
    """Screen a user against sanctions and PEP lists."""
    logger.info("aml_task_started", user_id=user_id, name=full_name)

    try:
        result = asyncio.run(
            screen_entity(full_name, date_of_birth, profile_type)
        )

        async def _save():
            from app.db.session import AsyncSessionLocal
            from app.models.aml import AMLScreening

            async with AsyncSessionLocal() as db:
                screening = AMLScreening(
                    user_id=user_id,
                    profile_type=result["profile_type"],
                    normalized_name=result["normalized_name"],
                    screening_provider=result["screening_provider"],
                    is_pep=result["is_pep"],
                    is_sanctioned=result["is_sanctioned"],
                    adverse_media_flag=result["adverse_media_flag"],
                    match_details=result["match_details"],
                    risk_flags=result["risk_flags"],
                )
                db.add(screening)
                await db.commit()

        asyncio.run(_save())
        logger.info("aml_task_complete", user_id=user_id)
        return {"status": "success", "is_sanctioned": result["is_sanctioned"], "is_pep": result["is_pep"]}

    except Exception as exc:
        logger.error("aml_task_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)
