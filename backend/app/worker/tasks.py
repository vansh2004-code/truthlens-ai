from .celery_app import celery_app
from .runner import execute_analysis, purge_expired


@celery_app.task(name="app.worker.tasks.process_analysis", bind=True)
def process_analysis(self, analysis_id: str) -> None:
    execute_analysis(analysis_id)


@celery_app.task(name="app.worker.tasks.purge_expired_media")
def purge_expired_media() -> dict:
    return purge_expired()
