import unicodedata
import httpx
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def normalize_name(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


async def screen_entity(
    full_name: str,
    date_of_birth: str | None = None,
    profile_type: str = "individual",
) -> dict:
    normalized = normalize_name(full_name)
    params: dict = {"q": normalized, "schema": "Person", "limit": 10}
    if date_of_birth:
        params["birth_date"] = date_of_birth

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{settings.OPENSANCTIONS_API_URL}/match/default",
                params=params,
                headers={"Authorization": f"ApiKey {settings.OPENSANCTIONS_API_KEY}"},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("opensanctions_request_failed", error=str(exc))
        # Return safe default — do not block user on API failure
        return _empty_result(normalized)

    results = data.get("results", [])
    is_sanctioned = any(r.get("score", 0) > 0.85 for r in results)
    is_pep = any("PEP" in r.get("datasets", []) for r in results)

    logger.info(
        "aml_screening_done",
        name=normalized,
        is_sanctioned=is_sanctioned,
        is_pep=is_pep,
    )
    return {
        "normalized_name": normalized,
        "screening_provider": "opensanctions",
        "profile_type": profile_type,
        "is_sanctioned": is_sanctioned,
        "is_pep": is_pep,
        "adverse_media_flag": False,  # plug in media API here
        "match_details": results[:5],
        "risk_flags": _build_risk_flags(is_sanctioned, is_pep),
    }


def _build_risk_flags(is_sanctioned: bool, is_pep: bool) -> list:
    flags = []
    if is_sanctioned:
        flags.append({"flag": "SANCTIONS_MATCH", "severity": "critical"})
    if is_pep:
        flags.append({"flag": "PEP_MATCH", "severity": "high"})
    return flags


def _empty_result(normalized: str) -> dict:
    return {
        "normalized_name": normalized,
        "screening_provider": "opensanctions",
        "profile_type": "individual",
        "is_sanctioned": False,
        "is_pep": False,
        "adverse_media_flag": False,
        "match_details": [],
        "risk_flags": [],
    }
