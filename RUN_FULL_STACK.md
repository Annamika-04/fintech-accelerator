# Running Frontend + Backend

This guide shows how to run both the React frontend and FastAPI backend together.

## Prerequisites

- Node.js 18+ (for frontend)
- Python 3.12+ (for backend)
- Docker & Docker Compose
- Supabase account with project created
- Redis running (via Docker or locally)

## Quick Start (5 minutes)

### Terminal 1: Backend Services
```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator

# Start Redis and other services
docker-compose up -d

# Check services are running
docker-compose ps
```

### Terminal 2: Backend API
```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator

# Install backend dependencies (first time only)
pip install -r requirements.txt

# Run FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 3: Frontend
```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator\frontend

# Install frontend dependencies (first time only)
npm install

# Start frontend dev server
npm run dev
```

**Then open**: http://localhost:5173

---

## Detailed Setup

### Step 1: Configure Environment Variables

#### Backend (.env in project root)
```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator

# Copy template
cp .env.supabase.example .env

# Edit .env and add:
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@[SUPABASE_HOST]:5432/postgres
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
SUPABASE_JWT_SECRET=[your-jwt-secret]
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=[your-key]
AWS_SECRET_ACCESS_KEY=[your-secret]
S3_BUCKET_NAME=kyc-documents-prod
GROQ_API_KEY=[your-groq-key]
OPENSANCTIONS_API_KEY=[your-sanctions-key]
```

#### Frontend (.env.local in frontend folder)
```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator\frontend

# Create .env.local file
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://[PROJECT].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
EOF
```

### Step 2: Initialize Database

Run this once to set up Supabase schema:

```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator

python setup_supabase.py
```

### Step 3: Start Docker Services

```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator

# Start Redis, workers, and Flower
docker-compose up -d

# Verify services
docker-compose ps

# Check logs
docker-compose logs -f redis
```

Expected output:
```
NAME           STATUS
redis          Up (healthy)
worker_ocr     Up
worker_face    Up
worker_aml     Up
worker_ai      Up
flower         Up (http://localhost:5555)
```

### Step 4: Start Backend API

```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator

# Install dependencies (first time)
pip install -r requirements.txt

# Run with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

Visit: http://localhost:8000/docs (API documentation)

### Step 5: Start Frontend

```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator\frontend

# Install dependencies (first time)
npm install

# Start development server
npm run dev
```

Expected output:
```
  VITE v5.3.4  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Visit: http://localhost:5173

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       User Browser                               │
│                   http://localhost:5173                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
                    ┌────────────────┐
                    │  React Frontend │ (Vite dev server)
                    │  Port 5173      │
                    └────────┬────────┘
                             │
                    (proxy /api → 8000)
                             │
                             ↓
          ┌──────────────────────────────────────┐
          │        FastAPI Backend API            │
          │        Port 8000                      │
          │  - User Management                    │
          │  - Document Upload                    │
          │  - KYC Verification                   │
          │  - AML Screening                      │
          └──────────┬───────────────┬────────────┘
                     │               │
        ┌────────────┴──┐       ┌────┴───────────┐
        │                │       │                 │
        ↓                ↓       ↓                 ↓
    ┌────────┐    ┌──────────┐ ┌────────┐    ┌──────────┐
    │Supabase│    │  Redis   │ │  S3    │    │AWS Face  │
    │  DB    │    │Cache/Q   │ │Storage │    │Rekog/OCR │
    └────────┘    └──────────┘ └────────┘    └──────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ↓             ↓             ↓
    ┌────────┐   ┌──────────┐  ┌──────────┐
    │Celery  │   │Celery    │  │Celery    │
    │OCR     │   │Face      │  │AML       │
    │Worker  │   │Worker    │  │Worker    │
    └────────┘   └──────────┘  └──────────┘
```

---

## Common Operations

### View API Docs
```
http://localhost:8000/docs
http://localhost:8000/redoc
```

### View Task Queue (Flower)
```
http://localhost:5555
```

### Check Backend Logs
```bash
# From project root
uvicorn app.main:app --reload --log-level debug
```

### Check Frontend Logs
```bash
# From frontend folder
npm run dev
# Logs appear in terminal + browser console
```

### Check Docker Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f redis
docker-compose logs -f worker_ocr
```

### Stop Everything
```bash
# Stop frontend (Ctrl+C in terminal 3)
# Stop backend (Ctrl+C in terminal 2)
# Stop docker services
docker-compose down
```

---

## Frontend Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          # Axios instance configured for API
│   │   └── supabase.ts        # Supabase client
│   ├── pages/                 # Route pages
│   ├── components/            # React components
│   ├── store/                 # Zustand state management
│   └── App.tsx
├── .env.local                 # Frontend env vars
├── vite.config.ts             # Vite config with API proxy
└── package.json
```

### Frontend-Backend Communication

The frontend connects to the backend via:
1. **Direct API calls**: `axios` → `http://localhost:8000/api/v1/*`
2. **Supabase Auth**: Direct to Supabase for authentication
3. **Real-time**: Can use Supabase real-time subscriptions

Vite proxy configured in `vite.config.ts`:
```typescript
proxy: {
  "/api": {
    target: "http://localhost:8000",
    changeOrigin: true,
  },
}
```

---

## Troubleshooting

### Frontend Can't Connect to Backend
```bash
# Check API is running
curl http://localhost:8000/docs

# Check .env.local has correct API URL
cat frontend/.env.local

# Check proxy works
curl http://localhost:5173/api/v1/health
```

### Database Connection Error
```bash
# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test connection
python -c "from app.db.session import AsyncSessionLocal; print('✓ Connected')"

# Check Supabase project is running
# Visit: https://app.supabase.com
```

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :5173   # Frontend
netstat -ano | findstr :8000   # Backend
netstat -ano | findstr :6379   # Redis

# Kill process (Windows)
taskkill /PID [PID] /F

# Or use different ports
npm run dev -- --port 3000      # Frontend
uvicorn app.main:app --port 8001 # Backend
```

### Node Modules Issues
```bash
# Clear and reinstall
cd frontend
rm -r node_modules package-lock.json
npm install
```

### Python Environment Issues
```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt
```

---

## Production Build

### Frontend
```bash
cd frontend
npm run build  # Creates dist/ folder
npm run preview  # Test production build locally
```

### Backend
```bash
# Use gunicorn in production (not uvicorn --reload)
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## Development Workflow

1. **Make backend changes** → API auto-reloads (uvicorn --reload)
2. **Make frontend changes** → Frontend auto-refreshes (Vite HMR)
3. **Database changes** → Use migrations or update models
4. **Test API** → http://localhost:8000/docs
5. **Test Frontend** → http://localhost:5173

---

## Full Startup Script (Optional)

Create `start-dev.sh` (Mac/Linux) or `start-dev.bat` (Windows):

**Windows (`start-dev.bat`):**
```batch
@echo off
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator

REM Terminal 1: Docker services
start cmd /k docker-compose up -d

REM Terminal 2: Backend
start cmd /k "pip install -r requirements.txt && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

REM Terminal 3: Frontend
start cmd /k "cd frontend && npm install && npm run dev"

echo.
echo Starting full stack...
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:8000/docs
echo Flower:    http://localhost:5555
```

Run with: `start-dev.bat`

---

## Quick Reference

| Service | Port | Command | URL |
|---------|------|---------|-----|
| Frontend | 5173 | `npm run dev` | http://localhost:5173 |
| Backend API | 8000 | `uvicorn app.main:app --reload` | http://localhost:8000/docs |
| Redis | 6379 | `docker-compose up -d` | - |
| Flower (Tasks) | 5555 | `docker-compose up -d` | http://localhost:5555 |
| Supabase | N/A | Browser console | https://app.supabase.com |

---

**Next**: Start with Step 1 above or use the quick start at the top!
