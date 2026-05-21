#!/usr/bin/env python3
"""
Setup script to initialize Supabase database from SQLAlchemy models.

Usage:
    python setup_supabase.py
"""

import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.base import Base
from app.core.config import settings


async def create_tables():
    """Create all tables from SQLAlchemy models."""
    engine = create_async_engine(
        settings.database_url_with_defaults(),
        connect_args=settings.database_connect_args(),
        echo=True,
    )

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✓ All tables created successfully!")
    except Exception as e:
        print(f"✗ Error creating tables: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        await engine.dispose()


async def main():
    print("Setting up Supabase database schema...")
    print(f"Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'N/A'}")

    await create_tables()
    print("\n✓ Setup complete!")
    print("\nNext steps:")
    print("1. Start Redis: docker run -d -p 6379:6379 redis:7-alpine")
    print("2. Start services: docker-compose up")


if __name__ == "__main__":
    asyncio.run(main())
