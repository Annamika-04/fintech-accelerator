import ssl
from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    AUTO_SYNC_DB_SCHEMA: bool = True

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_URL_CELERY: str = ""  # defaults to REDIS_URL if not set

    # AWS
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_SESSION_TOKEN: str = ""

    # S3
    S3_BUCKET_NAME: str
    S3_PRESIGNED_URL_EXPIRY: int = 900

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Rekognition
    FACE_SIMILARITY_THRESHOLD: float = 90.0
    FACE_CONFIDENCE_THRESHOLD: float = 99.0

    # Groq
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama3-70b-8192"

    # AML
    OPENSANCTIONS_API_KEY: str = ""
    OPENSANCTIONS_API_URL: str = "https://api.opensanctions.org"

    # Risk Engine
    RISK_AUTO_APPROVE_MAX: int = 29
    RISK_MANUAL_REVIEW_MAX: int = 59
    RISK_ESCALATION_MAX: int = 84

    # OCR Bypass Settings
    ENABLE_OCR_BYPASS: bool = False  # Set to True to bypass OCR failures
    OCR_BYPASS_SCORE: int = 45       # Score to assign when OCR is bypassed
    REQUIRE_MANUAL_REVIEW_ON_BYPASS: bool = True  # Force manual review when bypassed

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"dev", "development"}:
                return True
        return value

    class Config:
        env_file = ".env"
        case_sensitive = True

    def database_config(self) -> tuple[str, dict]:
        """
        Build a SQLAlchemy-compatible database URL and connect args.

        `asyncpg` does not accept the libpq-style `sslmode` keyword directly,
        so any SSL requirement must be translated into `connect_args={"ssl": ...}`.
        """
        url = self.DATABASE_URL
        if not url:
            return url, {}

        parsed = urlsplit(url)
        if parsed.scheme not in {"postgresql", "postgresql+asyncpg"}:
            return url, {}

        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        hostname = (parsed.hostname or "").lower()
        is_asyncpg = parsed.scheme == "postgresql+asyncpg"
        is_supabase = "supabase.co" in hostname

        connect_args = {}
        sslmode = query.pop("sslmode", None)
        ssl_flag = query.pop("ssl", None)

        if is_asyncpg:
            if sslmode in {"require", "verify-ca", "verify-full"}:
                connect_args["ssl"] = self._build_asyncpg_ssl_context(sslmode)
            elif ssl_flag is not None:
                enabled = ssl_flag.lower() not in {"0", "false", "no", "disable"}
                connect_args["ssl"] = self._build_asyncpg_ssl_context("require") if enabled else False
            elif is_supabase:
                connect_args["ssl"] = self._build_asyncpg_ssl_context("require")
        else:
            if sslmode is not None:
                query["sslmode"] = sslmode
            if ssl_flag is not None:
                query["ssl"] = ssl_flag

        normalized_url = urlunsplit(parsed._replace(query=urlencode(query)))
        return normalized_url, connect_args

    def database_url_with_defaults(self) -> str:
        return self.database_config()[0]

    def database_connect_args(self) -> dict:
        return self.database_config()[1]

    @staticmethod
    def _build_asyncpg_ssl_context(sslmode: str):
        """
        Translate libpq-style sslmode semantics to an asyncpg-compatible SSL context.

        - require: encrypted connection, no CA/hostname verification
        - verify-ca / verify-full: strict certificate validation
        """
        if sslmode in {"verify-ca", "verify-full"}:
            ctx = ssl.create_default_context()
            if sslmode == "verify-ca":
                ctx.check_hostname = False
            return ctx

        if sslmode == "require":
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            return ctx

        return False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
