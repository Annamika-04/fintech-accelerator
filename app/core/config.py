from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_URL_CELERY: str = ""  # defaults to REDIS_URL if not set

    # AWS
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

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

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
