#!/usr/bin/env python
"""
Migrate entire database schema to Supabase.
Applies all SQL migrations in order to your Supabase PostgreSQL database.
"""
import asyncio
import os
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

async def run_migrations():
    """Run all migrations in sequence."""

    # Load DATABASE_URL from .env
    from app.core.config import settings

    if not settings.DATABASE_URL:
        print("ERROR: DATABASE_URL not configured in .env")
        return False

    print("=" * 70)
    print("Supabase Database Migration")
    print("=" * 70)
    print(f"Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'unknown'}\n")

    # Create async engine
    engine = create_async_engine(
        settings.database_url_with_defaults(),
        connect_args=settings.database_connect_args(),
        echo=False,
    )

    migration_dir = Path("app/db/migrations")
    if not migration_dir.exists():
        print(f"ERROR: Migration directory not found: {migration_dir}")
        return False

    # Get all migration files in order
    migrations = sorted(migration_dir.glob("*.sql"))

    if not migrations:
        print("ERROR: No migration files found")
        return False

    print(f"Found {len(migrations)} migration(s):\n")
    for m in migrations:
        print(f"  - {m.name}")
    print()

    try:
        async with engine.begin() as conn:
            for migration_file in migrations:
                print(f"\n[{migration_file.name}]")
                print("-" * 70)

                # Read migration SQL
                sql_content = migration_file.read_text()

                # Split by semicolon and filter empty statements
                statements = [
                    s.strip()
                    for s in sql_content.split(';')
                    if s.strip() and not s.strip().startswith('--')
                ]

                # Execute each statement
                for i, statement in enumerate(statements, 1):
                    try:
                        print(f"  Executing statement {i}/{len(statements)}...", end=" ", flush=True)
                        await conn.execute(text(statement))
                        print("OK")
                    except Exception as e:
                        # Check if it's a "already exists" error (acceptable)
                        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                            print(f"SKIPPED (already exists)")
                        else:
                            print(f"ERROR: {e}")
                            raise

            # Commit all changes
            print("\n" + "=" * 70)
            print("Committing changes to database...")
            await conn.commit()

        print("SUCCESS: All migrations applied!")
        print("=" * 70)
        return True

    except Exception as e:
        print(f"\nERROR during migration: {e}")
        print("=" * 70)
        return False
    finally:
        await engine.dispose()


async def verify_schema():
    """Verify that all tables were created."""
    from app.core.config import settings

    print("\n" + "=" * 70)
    print("Verifying Schema")
    print("=" * 70 + "\n")

    engine = create_async_engine(
        settings.database_url_with_defaults(),
        connect_args=settings.database_connect_args(),
        echo=False,
    )

    try:
        async with engine.connect() as conn:
            # Get all tables
            result = await conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))

            tables = [row[0] for row in result.fetchall()]

            if tables:
                print(f"Found {len(tables)} tables:\n")
                for table in tables:
                    # Get column count
                    col_result = await conn.execute(text(f"""
                        SELECT COUNT(*)
                        FROM information_schema.columns
                        WHERE table_name = '{table}'
                    """))
                    col_count = col_result.scalar()
                    print(f"  ✓ {table} ({col_count} columns)")

                print("\nSchema verification: SUCCESS")
                return True
            else:
                print("No tables found. Migration may have failed.")
                return False

    except Exception as e:
        print(f"ERROR during verification: {e}")
        return False
    finally:
        await engine.dispose()


async def main():
    """Run migrations and verify."""
    success = await run_migrations()

    if success:
        verify_success = await verify_schema()
        if verify_success:
            print("\n" + "=" * 70)
            print("Migration Complete!")
            print("=" * 70)
            print("\nYour Supabase database is now ready.")
            print("\nNext steps:")
            print("  1. Run: python verify_setup.py")
            print("  2. Run: .\\start-backend.ps1")
            print("  3. Test: curl -X POST http://localhost:8000/api/v1/auth/send-otp ...")
            return 0

    return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
