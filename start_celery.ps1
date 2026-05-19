# start_celery.ps1
# Run from project root in a separate terminal: .\start_celery.ps1

Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
& ".\venv\Scripts\Activate.ps1"
.\venv\Scripts\celery.exe -A app.tasks.celery_app.celery_app worker -Q ocr,face,aml,ai -l info --pool=solo
