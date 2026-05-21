@echo off
REM Full Stack Development Startup Script
REM Starts Backend, Frontend, and Docker services

echo.
echo ============================================
echo  Fintech Accelerator - Full Stack Startup
echo ============================================
echo.

cd /d "%~dp0"

REM Check if .env exists
if not exist .env (
    echo ERROR: .env file not found!
    echo Please create .env file with Supabase credentials
    echo See: .env.supabase.example
    pause
    exit /b 1
)

echo [1/3] Starting Docker services (Redis, Workers, Flower)...
start cmd /k "docker-compose up -d && echo. && echo Docker services started! && echo Flower UI: http://localhost:5555 && pause"

timeout /t 3 /nobreak

echo [2/3] Starting Backend API (Port 8000)...
start cmd /k "title Backend API && pip install -r requirements.txt >nul 2>&1 && echo. && echo Starting FastAPI... && echo. && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 && pause"

timeout /t 3 /nobreak

echo [3/3] Starting Frontend (Port 5173)...
start cmd /k "title Frontend && cd frontend && npm install >nul 2>&1 && echo. && echo Starting React... && echo. && npm run dev"

echo.
echo ============================================
echo        Full Stack Started!
echo ============================================
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:8000/docs
echo Flower:    http://localhost:5555
echo.
echo Press any key to continue...
pause
