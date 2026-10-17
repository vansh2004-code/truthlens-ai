from celery import Celery

from ..config import get_settings

s = get_settings()
celery_app = Celery("truthlens", broker=s.redis_url, backend=s.redis_url, include=["app.worker.tasks"])
celery_app.conf.update(
    task_acks_late=True, worker_prefetch_multiplier=1, task_track_started=True,
    task_time_limit=s.job_timeout_seconds + 60, task_soft_time_limit=s.job_timeout_seconds,
    broker_connection_retry_on_startup=True, result_expires=3600, task_serializer="json", accept_content=["json"],
    beat_schedule={"purge-expired-media": {"task": "app.worker.tasks.purge_expired_media", "schedule": 3600.0}},
)
