from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings

engine = create_async_engine(
    settings.database_url_with_defaults(),
    connect_args=settings.database_connect_args(),
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def task_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Fresh engine + session for Celery tasks — avoids shared loop issues with asyncpg."""
    task_engine = create_async_engine(
        settings.database_url_with_defaults(),
        connect_args=settings.database_connect_args(),
        pool_size=2,
        max_overflow=2,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )
    session_factory = async_sessionmaker(bind=task_engine, expire_on_commit=False, autoflush=False)
    try:
        async with session_factory() as session:
            yield session
    finally:
        await task_engine.dispose()
