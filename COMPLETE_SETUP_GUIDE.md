# 📋 Complete Setup Guide - PostgreSQL → Supabase + Frontend/Backend

This document is your all-in-one reference for the migration and running the complete stack.

## 📑 Table of Contents

1. [Migration Summary](#migration-summary)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Frontend & Backend](#frontend--backend)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## ✅ Migration Summary

### What Changed
- ❌ **Removed**: Local PostgreSQL container from `docker-compose.yml`
- ✅ **Added**: Supabase as managed PostgreSQL database
- ✅ **Updated**: Environment configuration for Supabase
- ✅ **Created**: Setup scripts and comprehensive guides

### What's Still Working
- ✅ SQLAlchemy ORM (unchanged)
- ✅ asyncpg driver (compatible with Supabase)
- ✅ FastAPI backend (no code changes)
- ✅ React frontend (connects to Supabase)
- ✅ Celery workers (async tasks)
- ✅ Redis (caching, task queue)

### Files Modified/Created

| File | Status | Purpose |
|------|--------|---------|
| `docker-compose.yml` | Modified | PostgreSQL service removed |
| `.env.example` | Modified | Updated DATABASE_URL format |
| `.env.supabase.example` | Created | Supabase credentials template |
| `setup_supabase.py` | Created | Database schema initialization |
| `QUICK_START.md` | Created | 3-step quick reference |
| `FRONTEND_BACKEND_GUIDE.md` | Created | Frontend + Backend setup |
| `RUN_FULL_STACK.md` | Created | Detailed full-stack guide |
| `SUPABASE_MIGRATION.md` | Created | Migration details |
| `SUPABASE_README.md` | Created | Supabase troubleshooting |
| `MIGRATION_CHECKLIST.md` | Created | Step-by-step checklist |
| `start-dev.bat` | Created | Automated startup (Windows) |

---

## 🚀 Quick Start

### 3-Step Setup

```bash
# Step 1: Configure
copy .env.supabase.example .env
# Edit .env with Supabase credentials

# Step 2: Initialize (Terminal 1)
docker-compose up -d
pip install -r requirements.txt
python setup_supabase.py

# Step 3: Run (3 terminals)
# Terminal 1 (already running docker-compose)
# Terminal 2: Backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Terminal 3: Frontend
cd frontend && npm install && npm run dev
```

**Result**:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000/docs
- Tasks: http://localhost:5555

---

## 📚 Detailed Setup

### 1. Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in project details
4. Wait for initialization (2-5 minutes)

### 2. Get Supabase Credentials

Navigate to **Settings → API**:
- Copy `Project URL` → `SUPABASE_URL`
- Copy `Anon public key` → `SUPABASE_ANON_KEY`
- Copy `Service role key` → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

Navigate to **Settings → Database**:
- Click "Reveal" next to postgres password
- Build `DATABASE_URL`:
  ```
  postgresql+asyncpg://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres
  ```

Navigate to **Settings → JWT Settings**:
- Copy JWT Secret → `SUPABASE_JWT_SECRET`

### 3. Configure Backend

```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator

# Create .env file
copy .env.supabase.example .env

# Edit .env and fill in:
# DATABASE_URL (from above)
# SUPABASE_URL
# SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_JWT_SECRET
# AWS_* (for S3, face recognition)
# Other API keys
```

### 4. Configure Frontend

```bash
cd frontend

# Create .env.local
cat > .env.local << EOF
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://[PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
EOF
```

### 5. Initialize Database

```bash
# This creates all tables from SQLAlchemy models
python setup_supabase.py

# Or use Alembic (if migrations exist)
alembic upgrade head
```

Verify in Supabase Dashboard → Table Editor:
- ✅ `users` table
- ✅ `individual_profiles` table
- ✅ `corporate_profiles` table
- ✅ `documents` table
- ✅ `onboarding_state` table
- ✅ etc.

---

## 🔧 Frontend & Backend

### Architecture

```
┌─────────────────────────────────────┐
│     React Frontend (Port 5173)       │
│     - User Interface                 │
│     - Forms & Components             │
│     - Axios API Client               │
└──────────────┬──────────────────────┘
               │ (proxy /api → 8000)
               ↓
┌──────────────────────────────────────┐
│    FastAPI Backend (Port 8000)       │
│    - REST API Endpoints              │
│    - SQLAlchemy ORM                  │
│    - Supabase Auth Integration       │
│    - Business Logic                  │
└──────────────┬──────────────────────┘
               │
    ┌──────────┼──────────┐
    ↓          ↓          ↓
┌────────┐ ┌────────┐ ┌──────────┐
│Supabase│ │ Redis  │ │ S3 / AWS │
│  DB    │ │ Cache  │ │  Services│
└────────┘ └────────┘ └──────────┘
```

### Running Both

**Terminal 1: Docker Services**
```bash
docker-compose up -d
# Starts: Redis, Celery Workers, Flower
```

**Terminal 2: Backend API**
```bash
cd project-root
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 3: Frontend**
```bash
cd frontend
npm install
npm run dev
```

### Frontend Endpoints

- **Login**: `/login`
- **Register**: `/register`
- **Dashboard**: `/dashboard` (after login)
- **Onboarding**: `/onboarding`
- **KYC Verification**: `/kyc`
- **AML Screening**: `/aml`

### Backend Endpoints

- **Auth**: `/api/v1/auth/*` (login, register, verify)
- **Documents**: `/api/v1/documents/*` (upload, list)
- **Face Verification**: `/api/v1/face-verification/*`
- **AML Screening**: `/api/v1/aml/*`
- **Risk Engine**: `/api/v1/risk/*`
- **Onboarding**: `/api/v1/onboarding/*`
- **Cases**: `/api/v1/cases/*`

---

## ✅ Verification

### Checklist

- [ ] Supabase project created and running
- [ ] All credentials in `.env` (backend) and `.env.local` (frontend)
- [ ] Docker containers running: `docker-compose ps`
- [ ] Backend API responding: `curl http://localhost:8000/docs`
- [ ] Frontend accessible: `http://localhost:5173`
- [ ] Database connected: Tables visible in Supabase Dashboard
- [ ] Can create user account
- [ ] Can login
- [ ] Can upload documents
- [ ] Background tasks running (check Flower: http://localhost:5555)

### Quick Tests

```bash
# 1. Test Backend
curl http://localhost:8000/docs

# 2. Test Frontend
curl http://localhost:5173

# 3. Test Database
python -c "from app.db.session import AsyncSessionLocal; print('✓ Connected')"

# 4. Test Redis
docker-compose exec redis redis-cli ping

# 5. View Supabase Dashboard
# https://app.supabase.com → Your Project → Table Editor
```

---

## 🐛 Troubleshooting

### Database Connection Failed

**Error**: `postgresql connection refused`

**Solution**:
1. Check DATABASE_URL in `.env` is correct
2. Verify Supabase project is "Running" in dashboard
3. Check credentials are not missing/invalid
4. Test connection: `psql postgres://...` (use psql from PostgreSQL client)

### Frontend Can't Call Backend

**Error**: `404 /api/v1/*` or `Cannot connect`

**Solution**:
1. Check backend is running: `http://localhost:8000/docs`
2. Check frontend `.env.local` has `VITE_API_URL=http://localhost:8000`
3. Check Vite proxy in `frontend/vite.config.ts`
4. Check CORS in backend: `app.main.py` middleware

### Supabase Auth Not Working

**Error**: `Invalid API key` or `Unauthorized`

**Solution**:
1. Verify `SUPABASE_ANON_KEY` is correct
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct (backend only!)
3. Check `SUPABASE_JWT_SECRET` is correct
4. Verify `SUPABASE_URL` format with `https://`

### Port Already in Use

**Error**: `Address already in use :5173` or `:8000`

**Solution**:
```bash
# Find process
netstat -ano | findstr :5173
# Kill process
taskkill /PID [PID] /F
```

### Node Modules Error

**Error**: `Cannot find module` or build failures

**Solution**:
```bash
cd frontend
rm -r node_modules package-lock.json
npm install
```

### Python Package Error

**Error**: `ModuleNotFoundError` or import errors

**Solution**:
```bash
pip install -r requirements.txt
# Or create fresh virtual environment
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

---

## 📖 Documentation Reference

| Document | Purpose |
|----------|---------|
| [QUICK_START.md](./QUICK_START.md) | 3-step quick reference |
| [FRONTEND_BACKEND_GUIDE.md](./FRONTEND_BACKEND_GUIDE.md) | Setup frontend + backend |
| [RUN_FULL_STACK.md](./RUN_FULL_STACK.md) | Full architecture guide |
| [SUPABASE_MIGRATION.md](./SUPABASE_MIGRATION.md) | Migration from PostgreSQL |
| [SUPABASE_README.md](./SUPABASE_README.md) | Supabase troubleshooting |
| [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) | Step-by-step checklist |
| [.env.supabase.example](./.env.supabase.example) | Credential template |

---

## 🎯 Next Steps

1. **Set up Supabase**: Create project, get credentials
2. **Configure environment**: Update `.env` and `frontend/.env.local`
3. **Initialize database**: Run `python setup_supabase.py`
4. **Start services**: Follow 3-terminal setup above
5. **Test**: Open http://localhost:5173
6. **Develop**: Make code changes (auto-reload)
7. **Deploy**: Configure production environment

---

## 📚 Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **React Docs**: https://react.dev
- **SQLAlchemy Async**: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html

---

## 💬 Support

**For issues**:
1. Check troubleshooting section above
2. Check relevant guide (SUPABASE_README.md, etc.)
3. Review API logs: `http://localhost:8000/docs`
4. Check Supabase dashboard for database issues
5. Check browser console (F12) for frontend errors

---

## ✨ Success Indicators

✅ Docker services running (`docker-compose ps`)  
✅ Backend API responding (`http://localhost:8000/docs`)  
✅ Frontend loading (`http://localhost:5173`)  
✅ Can register new user  
✅ Can login  
✅ User data stored in Supabase  
✅ Tasks running in Celery  
✅ No errors in logs  

---

**Ready?** Start with [QUICK_START.md](./QUICK_START.md) 🚀
