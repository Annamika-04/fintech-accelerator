import asyncio
from celery.exceptions import Retry
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
    """Screen a user against sanctions and PEP lists, then advance to UNDER_REVIEW."""
    logger.info("aml_task_started", user_id=user_id, name=full_name)

    async def _run():
        from sqlalchemy import select
        from app.db.session import task_db_session
        from app.models.aml import AMLScreening
        from app.models.onboarding import OnboardingState, OnboardingStatus

        result = await screen_entity(full_name, date_of_birth, profile_type)

        async with task_db_session() as db:
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
            await db.flush()

            state_res = await db.execute(
                select(OnboardingState).where(OnboardingState.user_id == user_id)
            )
            state = state_res.scalar_one_or_none()

            if state and state.current_status == OnboardingStatus.AML_PENDING:
                state.current_status = OnboardingStatus.UNDER_REVIEW
                state.aml_score = _calculate_aml_score(result)
                logger.info(
                    "aml_status_advanced",
                    user_id=user_id,
                    is_sanctioned=result["is_sanctioned"],
                    is_pep=result["is_pep"],
                    aml_score=state.aml_score,
                )
            else:
                logger.info(
                    "aml_status_skipped",
                    user_id=user_id,
                    current_status=state.current_status.value if state else "none",
                )

            await db.commit()

        return result

    try:
        result = asyncio.run(_run())
        logger.info("aml_task_complete", user_id=user_id)
        return {
            "status": "success",
            "is_sanctioned": result["is_sanctioned"],
            "is_pep": result["is_pep"],
        }
    except Retry:
        raise
    except Exception as exc:
        logger.error("aml_task_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)


def _calculate_aml_score(result: dict) -> int:
    score = 0
    if result.get("is_sanctioned"):
        score += 50
    if result.get("is_pep"):
        score += 25
    if result.get("adverse_media_flag"):
        score += 15
    return min(score, 100)
