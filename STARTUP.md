# Daily Startup Guide

Open 3 separate PowerShell terminals and run one command in each.

## Terminal 1 — FastAPI Backend (port 8000)
cd C:\Users\OneData\Documents\Fintech_base
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\venv\Scripts\Activate.ps1
.\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload

Run this from project root: .\start_backend.ps1 ( from start_celery.ps1)

## Terminal 2 — React Frontend (port 5173)
cd C:\Users\OneData\Documents\Fintech_base\frontend
npm run dev

## Terminal 3 — Celery Worker (background tasks)
cd C:\Users\OneData\Documents\Fintech_base
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\venv\Scripts\Activate.ps1
.\venv\Scripts\celery.exe -A app.tasks.celery_app.celery_app worker -Q ocr,face,aml,ai -l info --pool=solo

## Always running automatically (no action needed)
- PostgreSQL  → Windows Service, starts with PC
- Redis       → Upstash cloud, always online

## URLs
- Frontend  → http://localhost:5173
- Backend   → http://localhost:8000
- API Docs  → http://localhost:8000/docs
