"""
Reset stuck onboarding state for a user.
Run this when face_verifications is stuck at 'pending' due to expired AWS token.

Usage:
    venv\Scripts\python.exe reset_onboarding.py
"""
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

USER_ID = "be185970-ed90-4c21-9f81-1178196321d0"  # from check_db output

async def run():
    async with AsyncSessionLocal() as db:

        # 1. Delete stuck face_verifications so fresh ones can be created
        r = await db.execute(text(
            "DELETE FROM face_verifications WHERE user_id = :uid AND status = 'pending'"
        ), {"uid": USER_ID})
        print(f"Deleted {r.rowcount} stuck face_verification(s)")

        # 2. Reset onboarding_state back to DOCUMENTS_UPLOADED
        #    so the user can re-submit selfie and trigger fresh tasks
        r = await db.execute(text(
            "UPDATE onboarding_state SET current_status = 'DOCUMENTS_UPLOADED' WHERE user_id = :uid"
        ), {"uid": USER_ID})
        print(f"Reset onboarding_state to DOCUMENTS_UPLOADED for {r.rowcount} row(s)")

        await db.commit()
        print("\nDone. User can now go back to Selfie step and resubmit.")
        print("Make sure fresh AWS credentials are in .env and workers are restarted.")

asyncio.run(run())
