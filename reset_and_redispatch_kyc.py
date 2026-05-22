"""Reset UNDER_REVIEW users back to DOCUMENTS_UPLOADED and re-dispatch KYC validation."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings


async def main():
    engine = create_async_engine(
        settings.database_url_with_defaults(),
        connect_args=settings.database_connect_args(),
    )
    async with engine.begin() as c:
        res = await c.execute(text("""
            UPDATE onboarding_state
            SET current_status = 'DOCUMENTS_UPLOADED'
            WHERE current_status = 'UNDER_REVIEW'
            RETURNING user_id
        """))
        user_ids = [str(row[0]) for row in res.fetchall()]

    print(f"Reset {len(user_ids)} users: {user_ids}")

    from app.tasks.kyc_tasks import run_kyc_validation
    for user_id in user_ids:
        run_kyc_validation.apply_async(args=[user_id], queue="ai")
        print(f"Dispatched KYC for {user_id}")

    await engine.dispose()


asyncio.run(main())
