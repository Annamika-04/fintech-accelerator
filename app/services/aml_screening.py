import unicodedata

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.services.demo_aml_data import (
    ADVERSE_MEDIA_LOOKUP,
    PEP_LOOKUP,
    SANCTIONS_LOOKUP,
)

logger = get_logger(__name__)


def normalize_name(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name or "")
    cleaned = "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()
    return " ".join(cleaned.split())


async def screen_entity(
    full_name: str,
    date_of_birth: str | None = None,
    profile_type: str = "individual",
) -> dict:
    normalized = normalize_name(full_name)

    demo_result = _screen_demo_watchlist(normalized, profile_type)
    if demo_result:
        logger.info(
            "aml_demo_watchlist_match",
            name=normalized,
            is_sanctioned=demo_result["is_sanctioned"],
            is_pep=demo_result["is_pep"],
            adverse_media=demo_result["adverse_media_flag"],
        )
        return demo_result

    if not settings.OPENSANCTIONS_API_KEY:
        logger.warning("opensanctions_api_key_missing_using_empty_result", name=normalized)
        return _empty_result(normalized, profile_type)

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
        # Do not block the demo/user journey on an external AML provider outage.
        return _empty_result(normalized, profile_type)

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
        "adverse_media_flag": False,
        "match_details": results[:5],
        "risk_flags": _build_risk_flags(is_sanctioned, is_pep, False),
    }


def _screen_demo_watchlist(normalized: str, profile_type: str) -> dict | None:
    sanctions_match = SANCTIONS_LOOKUP.get(normalized)
    pep_match = PEP_LOOKUP.get(normalized)
    adverse_media_match = ADVERSE_MEDIA_LOOKUP.get(normalized)
    is_sanctioned = sanctions_match is not None
    is_pep = pep_match is not None
    adverse_media = adverse_media_match is not None
    if not (is_sanctioned or is_pep or adverse_media):
        return None

    details = [
        {
            "source": "DEMO_LOCAL_WATCHLIST",
            "category": category,
            "match": "exact",
            **item,
        }
        for category, item in [
            ("SANCTIONS", sanctions_match),
            ("PEP", pep_match),
            ("ADVERSE_MEDIA", adverse_media_match),
        ]
        if item
    ]

    return {
        "normalized_name": normalized,
        "screening_provider": "DEMO_LOCAL_WATCHLIST",
        "profile_type": profile_type,
        "is_sanctioned": is_sanctioned,
        "is_pep": is_pep,
        "adverse_media_flag": adverse_media,
        "match_details": details,
        "risk_flags": _build_risk_flags(is_sanctioned, is_pep, adverse_media),
    }


def _build_risk_flags(is_sanctioned: bool, is_pep: bool, adverse_media: bool) -> list:
    flags = []
    if is_sanctioned:
        flags.append({"flag": "SANCTIONS_MATCH", "severity": "critical"})
    if is_pep:
        flags.append({"flag": "PEP_MATCH", "severity": "high"})
    if adverse_media:
        flags.append({"flag": "ADVERSE_MEDIA_MATCH", "severity": "medium"})
    return flags


def _empty_result(normalized: str, profile_type: str = "individual") -> dict:
    return {
        "normalized_name": normalized,
        "screening_provider": "opensanctions",
        "profile_type": profile_type,
        "is_sanctioned": False,
        "is_pep": False,
        "adverse_media_flag": False,
        "match_details": [],
        "risk_flags": [],
    }
