from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "kyc_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
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
    task_routes={
        "app.tasks.ocr_tasks.*": {"queue": "ocr"},
        "app.tasks.face_tasks.*": {"queue": "face"},
        "app.tasks.aml_tasks.*": {"queue": "aml"},
        "app.tasks.ai_tasks.*": {"queue": "ai"},
    },
    task_default_retry_delay=30,
    task_max_retries=3,
)
