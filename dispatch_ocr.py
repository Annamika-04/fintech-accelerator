import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.database_url_with_defaults(), connect_args=settings.database_connect_args())
    async with engine.connect() as c:
        res = await c.execute(text(
            "SELECT id, user_id, s3_key FROM documents "
            "WHERE verification_status = 'pending' AND upload_status = 'uploaded'"
        ))
        rows = res.fetchall()
        if not rows:
            print("No pending documents found")
            return

        from app.tasks.ocr_tasks import run_ocr
        for doc_id, user_id, s3_key in rows:
            print(f"Dispatching OCR for doc {doc_id} user {user_id}")
            run_ocr.apply_async(
                args=[str(doc_id), s3_key, str(user_id)],
                queue="dev_ocr",
            )
    await engine.dispose()

asyncio.run(main())
