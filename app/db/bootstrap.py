from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import text

from app.core.logging import get_logger
from app.db.base import Base
from app.models import (  # noqa: F401
    Alert,
    AMLScreening,
    AuditLog,
    Case,
    CorporateDirector,
    CorporateProfile,
    Document,
    DocumentVerification,
    FaceVerification,
    IndividualProfile,
    OnboardingState,
    RiskScore,
    User,
)

logger = get_logger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
BOOTSTRAP_MIGRATIONS = [
    MIGRATIONS_DIR / "005_saas_kyc_backbone.sql",
]


async def _apply_bootstrap_migrations(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        for path in BOOTSTRAP_MIGRATIONS:
            if not path.exists():
                continue
            raw_sql = path.read_text(encoding="utf-8")
            sql_text = "\n".join(
                line for line in raw_sql.splitlines()
                if not line.strip().startswith("--")
            )
            statements = [stmt.strip() for stmt in sql_text.split(";") if stmt.strip()]
            for statement in statements:
                await conn.execute(text(statement))
            logger.info("database_bootstrap_migration_applied", migration=path.name)


async def ensure_database_schema(engine: AsyncEngine) -> None:
    """
    Create any missing SQLAlchemy-managed tables and enum types.

    This keeps the Supabase schema aligned with the backend models for local
    development and avoids hard failures when only part of the schema exists.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _apply_bootstrap_migrations(engine)
    logger.info("database_schema_sync_complete")
