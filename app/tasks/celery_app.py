from celery import Celery
from app.core.config import settings

# Use REDIS_URL_CELERY if set (needed for Upstash SSL), else fall back to REDIS_URL
_broker = settings.REDIS_URL_CELERY if settings.REDIS_URL_CELERY else settings.REDIS_URL
_backend = settings.REDIS_URL_CELERY if settings.REDIS_URL_CELERY else settings.REDIS_URL

celery_app = Celery(
    "kyc_worker",
    broker=_broker,
    backend=_backend,
    include=[
        "app.tasks.ocr_tasks",
        "app.tasks.face_tasks",
        "app.tasks.aml_tasks",
        "app.tasks.ai_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # SSL config for Upstash rediss:// URLs
    broker_use_ssl={"ssl_cert_reqs": "CERT_NONE"} if _broker.startswith("rediss://") else None,
    redis_backend_use_ssl={"ssl_cert_reqs": "CERT_NONE"} if _backend.startswith("rediss://") else None,
    task_routes={
        "app.tasks.ocr_tasks.*": {"queue": "ocr"},
        "app.tasks.face_tasks.*": {"queue": "face"},
        "app.tasks.aml_tasks.*": {"queue": "aml"},
        "app.tasks.ai_tasks.*": {"queue": "ai"},
    },
    task_default_retry_delay=30,
    task_max_retries=3,
    # Required for Windows — prefork uses Unix shared memory which Windows blocks
    worker_pool="solo",
)
