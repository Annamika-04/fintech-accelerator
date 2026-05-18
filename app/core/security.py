import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, status
from app.core.config import settings

_jwks_cache: dict = {}


async def _get_jwks() -> dict:
    global _jwks_cache
    if not _jwks_cache:
        async with httpx.AsyncClient() as client:
            resp = await client.get(settings.COGNITO_JWKS_URL, timeout=10.0)
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def verify_cognito_token(token: str) -> dict:
    try:
        jwks = await _get_jwks()
        header = jwt.get_unverified_header(token)
        key = next((k for k in jwks["keys"] if k["kid"] == header["kid"]), None)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token signing key not found",
            )
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.COGNITO_CLIENT_ID,
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {exc}",
        )


def invalidate_jwks_cache() -> None:
    """Call this to force JWKS refresh (e.g. after key rotation)."""
    global _jwks_cache
    _jwks_cache = {}
