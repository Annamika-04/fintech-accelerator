"""
Supabase Auth admin operations using the REST Management API.
Uses the service_role key — never expose this to the frontend.
"""
import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

SUPABASE_AUTH_ADMIN_URL = f"{settings.SUPABASE_URL}/auth/v1/admin"

_headers = {
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}


async def create_supabase_user(email: str, password: str) -> dict:
    """Create a user in Supabase Auth and return their uid."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_AUTH_ADMIN_URL}/users",
            headers=_headers,
            json={"email": email, "password": password, "email_confirm": True},
            timeout=10.0,
        )
    if resp.status_code not in (200, 201):
        logger.error("supabase_create_user_failed", email=email, detail=resp.text)
        raise HTTPException(status_code=400, detail=f"Supabase error: {resp.json().get('message', resp.text)}")
    return resp.json()


async def delete_supabase_user(supabase_uid: str) -> None:
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{SUPABASE_AUTH_ADMIN_URL}/users/{supabase_uid}",
            headers=_headers,
            timeout=10.0,
        )
    if resp.status_code not in (200, 204):
        logger.warning("supabase_delete_user_failed", uid=supabase_uid, detail=resp.text)


async def update_supabase_user_metadata(supabase_uid: str, metadata: dict) -> None:
    """Store role and other metadata in Supabase user_metadata."""
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{SUPABASE_AUTH_ADMIN_URL}/users/{supabase_uid}",
            headers=_headers,
            json={"user_metadata": metadata},
            timeout=10.0,
        )
    if resp.status_code not in (200, 201):
        logger.warning("supabase_update_metadata_failed", uid=supabase_uid, detail=resp.text)
