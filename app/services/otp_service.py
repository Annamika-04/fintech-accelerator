"""
OTP service — stores OTPs in Redis with TTL.
Prints OTP to terminal for demo/dev mode.
Swap-ready: replace _send() with Twilio/MSG91 later.
"""
import random
import redis.asyncio as aioredis
from app.core.config import settings

OTP_TTL = 300          # 5 minutes
MAX_ATTEMPTS = 5       # wrong OTP attempts before lockout
MAX_RESENDS = 3        # resend requests per 10 minutes
RESEND_WINDOW = 600    # 10 minutes


def _redis() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


def _otp_key(phone: str) -> str:
    return f"otp:{phone}"


def _attempts_key(phone: str) -> str:
    return f"otp_attempts:{phone}"


def _resend_key(phone: str) -> str:
    return f"otp_resend:{phone}"


def _generate_otp() -> str:
    return str(random.randint(100000, 999999))


def _print_otp(phone: str, otp: str) -> None:
    print("\n" + "=" * 45)
    print("  📱  OTP LOGIN  —  DEMO MODE")
    print("=" * 45)
    print(f"  Phone : {phone}")
    print(f"  OTP   : {otp}")
    print(f"  TTL   : {OTP_TTL}s")
    print("=" * 45 + "\n")


async def send_otp(phone: str) -> dict:
    """
    Generate OTP, store in Redis, print to terminal.
    Returns {"success": True} or raises ValueError on rate limit.
    """
    r = _redis()
    async with r:
        # Rate-limit resends
        resend_count = await r.get(_resend_key(phone))
        if resend_count and int(resend_count) >= MAX_RESENDS:
            raise ValueError("Too many OTP requests. Please wait 10 minutes.")

        otp = _generate_otp()
        await r.setex(_otp_key(phone), OTP_TTL, otp)

        # Track resend count
        pipe = r.pipeline()
        pipe.incr(_resend_key(phone))
        pipe.expire(_resend_key(phone), RESEND_WINDOW)
        await pipe.execute()

        # Reset attempt counter on fresh OTP
        await r.delete(_attempts_key(phone))

        _print_otp(phone, otp)
        return {"success": True, "message": "OTP generated successfully"}


async def verify_otp(phone: str, otp: str) -> bool:
    """
    Verify OTP. Returns True on match, False on mismatch.
    Raises ValueError on expired/not-found or too many attempts.
    Deletes OTP from Redis on success.
    """
    r = _redis()
    async with r:
        # Check attempt count
        attempts = await r.get(_attempts_key(phone))
        if attempts and int(attempts) >= MAX_ATTEMPTS:
            raise ValueError("Too many failed attempts. Request a new OTP.")

        stored = await r.get(_otp_key(phone))
        if not stored:
            raise ValueError("OTP expired or not found. Please request a new one.")

        if stored != otp.strip():
            await r.incr(_attempts_key(phone))
            await r.expire(_attempts_key(phone), OTP_TTL)
            return False

        # Valid — clean up
        await r.delete(_otp_key(phone))
        await r.delete(_attempts_key(phone))
        await r.delete(_resend_key(phone))
        return True
