import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.database_url_with_defaults(), connect_args=settings.database_connect_args())
    async with engine.connect() as c:
        res = await c.execute(text(
            "SELECT id, user_id, selfie_s3_key, id_document_s3_key FROM face_verifications "
            "WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1"
        ))
        row = res.fetchone()
        if not row:
            print("No pending face verifications found")
            return
        fv_id, user_id, selfie, id_doc = row
        print(f"Dispatching face task for: {fv_id}")
        print(f"  selfie:  {selfie}")
        print(f"  id_doc:  {id_doc}")
        print(f"  user_id: {user_id}")

        from app.tasks.face_tasks import run_face_verification
        result = run_face_verification.apply_async(
            args=[str(fv_id), selfie, id_doc, str(user_id)],
            queue="face",
        )
        print(f"Task dispatched: {result.id}")
    await engine.dispose()

asyncio.run(main())
