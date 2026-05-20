#!/usr/bin/env python
"""Verify Fintech Accelerator setup is correct."""
import asyncio
import sys
from pathlib import Path

async def verify_database():
    """Test database connection."""
    try:
        from sqlalchemy import text
        from app.db.session import engine

        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            if result.scalar():
                print("[OK] Database connection successful")
                return True
    except Exception as e:
        print(f"[FAIL] Database connection failed: {e}")
        return False

def verify_env():
    """Check .env file exists."""
    if Path(".env").exists():
        print("[OK] .env file exists")
        return True
    else:
        print("[FAIL] .env file not found")
        return False

def verify_config():
    """Check settings load correctly."""
    try:
        from app.core.config import settings
        print("[OK] Configuration loaded")

        if not settings.DATABASE_URL:
            print("[FAIL] DATABASE_URL not set")
            return False

        if not settings.SUPABASE_URL:
            print("[WARN] SUPABASE_URL not set (optional)")

        print(f"[OK] DATABASE_URL configured: {settings.DATABASE_URL[:40]}...")
        return True
    except Exception as e:
        print(f"[FAIL] Config error: {e}")
        return False

def verify_models():
    """Check database models."""
    try:
        from app.models.user import User, UserRole
        from app.models.document import Document
        print("[OK] All models loaded")
        return True
    except Exception as e:
        print(f"[FAIL] Model error: {e}")
        return False

def verify_dependencies():
    """Check all dependencies installed."""
    deps = [
        "fastapi",
        "sqlalchemy",
        "asyncpg",
        "pydantic",
        "redis",
        "boto3",
    ]

    missing = []
    for dep in deps:
        try:
            __import__(dep)
        except ImportError:
            missing.append(dep)

    if missing:
        print(f"[WARN] Missing packages: {', '.join(missing)}")
        return False

    print("[OK] All dependencies installed")
    return True

async def main():
    """Run all verifications."""
    print("=" * 60)
    print("Fintech Accelerator Setup Verification")
    print("=" * 60 + "\n")

    checks = [
        ("Dependencies", verify_dependencies),
        ("Environment", verify_env),
        ("Configuration", verify_config),
        ("Models", verify_models),
        ("Database", verify_database),
    ]

    results = []
    for name, check in checks:
        print(f"\n[CHECK] {name}...")
        try:
            if asyncio.iscoroutinefunction(check):
                result = await check()
            else:
                result = check()
            results.append((name, result))
        except Exception as e:
            print(f"[ERROR] {name}: {e}")
            results.append((name, False))

    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    for name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{name}: {status}")

    all_passed = all(r for _, r in results)
    if all_passed:
        print("\nAll checks passed! Ready to start backend.")
        sys.exit(0)
    else:
        print("\nSome checks failed. Please fix issues above.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
