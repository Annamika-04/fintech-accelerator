import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, status
from app.core.config import settings

_jwks_cache: dict = {}


async def _get_supabase_jwks() -> dict:
    global _jwks_cache
    if not _jwks_cache:
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        async with httpx.AsyncClient() as client:
            resp = await client.get(jwks_url, timeout=10.0)
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def verify_supabase_token(token: str) -> dict:
    """
    Verify a Supabase JWT.
    - Tries RS256 via JWKS first (modern Supabase projects)
    - Falls back to HS256 using SUPABASE_JWT_SECRET (legacy projects)
    """

    # ── Try RS256 via JWKS (modern Supabase) ─────────────────────────────────
    try:
        jwks = await _get_supabase_jwks()
        if jwks.get("keys"):
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            key = next((k for k in jwks["keys"] if k.get("kid") == kid), None)

            # If no kid match, try the first available key
            if not key and jwks["keys"]:
                key = jwks["keys"][0]

            if key:
                payload = jwt.decode(
                    token,
                    key,
                    algorithms=["RS256", "ES256"],
                    options={"verify_aud": False},
                )
                return payload
    except JWTError:
        pass  # fall through to HS256
    except Exception:
        pass  # JWKS fetch failed, fall through

    # ── Fallback: HS256 with legacy JWT secret ────────────────────────────────
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            return payload
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token validation failed: {exc}",
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No valid JWT verification method configured",
    )


def invalidate_jwks_cache() -> None:
    global _jwks_cache
    _jwks_cache = {}
