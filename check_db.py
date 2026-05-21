import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def run():
    async with AsyncSessionLocal() as db:

        # 1. Latest face verifications
        r = await db.execute(text("""
            SELECT id, user_id, status, is_match,
                   similarity_score, confidence_score, created_at
            FROM face_verifications
            ORDER BY created_at DESC LIMIT 5
        """))
        rows = r.fetchall()
        print("\n=== face_verifications (latest 5) ===")
        if not rows:
            print("  No records found")
        for row in rows:
            print(f"  id={str(row[0])[:8]}... user={str(row[1])[:8]}... "
                  f"status={row[2]} is_match={row[3]} "
                  f"similarity={row[4]} created={row[6]}")

        # 2. Onboarding state
        r = await db.execute(text("""
            SELECT user_id, current_status, onboarding_type,
                   kyc_score, aml_score, final_score, decision, updated_at
            FROM onboarding_state
            ORDER BY updated_at DESC LIMIT 5
        """))
        rows = r.fetchall()
        print("\n=== onboarding_state (latest 5) ===")
        if not rows:
            print("  No records found")
        for row in rows:
            print(f"  user={str(row[0])[:8]}... status={row[1]} "
                  f"type={row[2]} kyc={row[3]} aml={row[4]} "
                  f"final={row[5]} decision={row[6]}")

        # 3. Document verifications
        r = await db.execute(text("""
            SELECT id, document_id, verification_status, created_at
            FROM document_verifications
            ORDER BY created_at DESC LIMIT 5
        """))
        rows = r.fetchall()
        print("\n=== document_verifications (latest 5) ===")
        if not rows:
            print("  No records found")
        for row in rows:
            print(f"  id={str(row[0])[:8]}... doc={str(row[1])[:8]}... "
                  f"status={row[2]} created={row[3]}")

asyncio.run(run())
