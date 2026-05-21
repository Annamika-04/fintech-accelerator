# start-backend.ps1
# Starts full backend: FastAPI + all Celery workers
# Usage: .\start-backend.ps1

Write-Host "🚀 Starting Full Backend (API + Workers)" -ForegroundColor Green

# Check if Redis is reachable (from .env or default)
$redisUrl = $env:REDIS_URL
if (-not $redisUrl) { $redisUrl = "redis://localhost:6379/0" }

Write-Host "Using Redis: $redisUrl" -ForegroundColor Yellow

# Start FastAPI
Start-Process powershell -ArgumentList "-NoExit", "-Command", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

# Start Celery workers
Start-Process powershell -ArgumentList "-NoExit", "-Command", "celery -A app.tasks.celery_app.celery_app worker -Q ocr -c 2 -l info -n ocr@%h" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "celery -A app.tasks.celery_app.celery_app worker -Q face -c 2 -l info -n face@%h" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "celery -A app.tasks.celery_app.celery_app worker -Q aml -c 2 -l info -n aml@%h" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "celery -A app.tasks.celery_app.celery_app worker -Q ai -c 1 -l info -n ai@%h" -WindowStyle Normal

Write-Host "✅ Backend started! API: http://localhost:8000" -ForegroundColor Green
Write-Host "   (Close the opened PowerShell windows to stop services)" -ForegroundColor Gray
