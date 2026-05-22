import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.database_url_with_defaults(), connect_args=settings.database_connect_args())
    async with engine.connect() as c:
        # Find users with completed face verification AND at least one completed OCR
        res = await c.execute(text("""
            SELECT DISTINCT fv.user_id
            FROM face_verifications fv
            WHERE fv.status = 'completed'
            AND EXISTS (
                SELECT 1 FROM document_verifications dv
                JOIN documents d ON d.id = dv.document_id
                WHERE d.user_id = fv.user_id
                AND dv.verification_status = 'completed'
            )
            AND EXISTS (
                SELECT 1 FROM onboarding_state os
                WHERE os.user_id = fv.user_id
                AND os.current_status IN ('KYC_PENDING', 'DOCUMENTS_UPLOADED')
            )
        """))
        users = [str(row[0]) for row in res.fetchall()]
        print(f"Found {len(users)} users ready for KYC validation: {users}")

        from app.tasks.kyc_tasks import run_kyc_validation
        for user_id in users:
            print(f"Dispatching kyc_validation for {user_id}")
            run_kyc_validation.apply_async(args=[user_id], queue="ai")

    await engine.dispose()

asyncio.run(main())
