import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.database_url_with_defaults(), connect_args=settings.database_connect_args())
    async with engine.connect() as c:
        print("--- status distribution ---")
        res = await c.execute(text("SELECT current_status, count(*) FROM onboarding_state GROUP BY current_status"))
        for row in res.fetchall():
            print(row)
        print("\n--- kyc_validation task in queues ---")
    await engine.dispose()

    import redis
    r = redis.from_url(settings.REDIS_URL, decode_responses=True)
    for q in ["ocr", "face", "aml", "ai", "celery"]:
        print(f"{q}: {r.llen(q)}")

asyncio.run(main())
