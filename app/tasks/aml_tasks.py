import asyncio
from celery.exceptions import Retry
from app.tasks.celery_app import celery_app
from app.services.aml_screening import screen_entity
from app.core.logging import get_logger

logger = get_logger(__name__)

AML_LOW_RISK_MAX = 29
AML_MANUAL_REVIEW_MAX = 59
AML_ESCALATION_MAX = 84


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
    """Screen a user against sanctions/PEP lists and update onboarding risk state."""
    logger.info("aml_task_started", user_id=user_id, name=full_name)

    async def _run():
        from sqlalchemy import select
        from app.db.session import task_db_session
        from app.models.aml import AMLScreening
        from app.models.onboarding import OnboardingState, OnboardingStatus
        from app.models.risk import Case

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

            aml_score = _calculate_aml_score(result)
            aml_decision = _aml_decision(result, aml_score)

            if state and state.current_status in {OnboardingStatus.AML_PENDING, OnboardingStatus.UNDER_REVIEW}:
                state.aml_score = aml_score
                state.final_score = _calculate_final_risk_score(state.kyc_score, aml_score)
                state.decision = aml_decision

                if aml_decision == "AUTO_REJECT":
                    state.current_status = OnboardingStatus.REJECTED
                else:
                    state.current_status = OnboardingStatus.UNDER_REVIEW

                logger.info(
                    "aml_status_advanced",
                    user_id=user_id,
                    is_sanctioned=result["is_sanctioned"],
                    is_pep=result["is_pep"],
                    adverse_media=result["adverse_media_flag"],
                    aml_score=aml_score,
                    aml_decision=aml_decision,
                    final_score=state.final_score,
                    current_status=state.current_status.value,
                )
            else:
                logger.info(
                    "aml_status_skipped",
                    user_id=user_id,
                    current_status=state.current_status.value if state else "none",
                )

            if result.get("is_sanctioned") or result.get("is_pep") or result.get("adverse_media_flag"):
                await _ensure_aml_case(
                    db,
                    Case,
                    user_id=user_id,
                    result=result,
                    aml_score=aml_score,
                    aml_decision=aml_decision,
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
            "adverse_media": result["adverse_media_flag"],
            "aml_score": _calculate_aml_score(result),
        }
    except Retry:
        raise
    except Exception as exc:
        logger.error("aml_task_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)


def _calculate_aml_score(result: dict) -> int:
    score = 0
    if result.get("is_sanctioned"):
        score += 95
    if result.get("is_pep"):
        score += 65
    if result.get("adverse_media_flag"):
        score += 65
    return min(score, 100)


def _aml_decision(result: dict, score: int) -> str:
    if result.get("is_sanctioned"):
        return "AUTO_REJECT"
    if result.get("is_pep"):
        return "MANUAL_REVIEW"
    if result.get("adverse_media_flag"):
        return "COMPLIANCE_ESCALATION"
    if score <= AML_LOW_RISK_MAX:
        return "LOW_RISK"
    if score <= AML_MANUAL_REVIEW_MAX:
        return "MANUAL_REVIEW"
    if score <= AML_ESCALATION_MAX:
        return "COMPLIANCE_ESCALATION"
    return "AUTO_REJECT"


def _calculate_final_risk_score(kyc_score: int | None, aml_score: int) -> int:
    # KYC score is a confidence score, so convert low confidence into risk.
    kyc_confidence = max(0, min(int(kyc_score or 0), 100))
    kyc_risk = max(0, 100 - kyc_confidence)
    return min(100, max(aml_score, kyc_risk))


async def _ensure_aml_case(db, case_model, *, user_id: str, result: dict, aml_score: int, aml_decision: str) -> None:
    from sqlalchemy import select

    case_type = _case_type_for_aml_result(result)
    existing = await db.execute(
        select(case_model).where(
            case_model.user_id == user_id,
            case_model.case_type == case_type,
            case_model.status == "open",
        )
    )
    if existing.scalar_one_or_none():
        return

    case = case_model(
        user_id=user_id,
        case_type=case_type,
        status="open",
        priority=_case_priority_for_aml_result(result),
        notes=_case_notes_for_aml_result(result, aml_score, aml_decision),
    )
    db.add(case)
    await db.flush()


def _case_type_for_aml_result(result: dict) -> str:
    if result.get("is_sanctioned"):
        return "sanctions_hit"
    if result.get("is_pep"):
        return "pep_match"
    if result.get("adverse_media_flag"):
        return "aml_alert"
    return "aml_alert"


def _case_priority_for_aml_result(result: dict) -> str:
    if result.get("is_sanctioned"):
        return "critical"
    if result.get("is_pep"):
        return "high"
    if result.get("adverse_media_flag"):
        return "high"
    return "medium"


def _case_notes_for_aml_result(result: dict, aml_score: int, aml_decision: str) -> str:
    match_details = result.get("match_details") or []
    detail = match_details[0] if match_details else {}
    category = detail.get("category") or "AML"
    name = detail.get("name") or result.get("normalized_name") or "Unknown"
    reason = detail.get("reason") or detail.get("position") or detail.get("headline") or "Watchlist match"
    provider = result.get("screening_provider", "unknown")
    return (
        f"{category} match for {name}. "
        f"Provider: {provider}. "
        f"AML score: {aml_score}. "
        f"Decision: {aml_decision}. "
        f"Reason: {reason}."
    )
