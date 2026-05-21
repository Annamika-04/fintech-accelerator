# Frontend & Backend Setup Guide

Quick guide to run both React frontend and FastAPI backend together.

## 🚀 Quick Start (3 Commands)

### Option 1: Automatic (Windows)
```bash
# Just double-click this file in File Explorer:
start-dev.bat
```

### Option 2: Manual (Windows/Mac/Linux)

**Terminal 1 - Docker Services:**
```bash
cd path/to/fintech-accelerator
docker-compose up -d
```

**Terminal 2 - Backend API:**
```bash
cd path/to/fintech-accelerator
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 3 - Frontend:**
```bash
cd path/to/fintech-accelerator/frontend
npm install
npm run dev
```

Then open: **http://localhost:5173**

---

## ✅ Prerequisites

- [ ] Node.js 18+ (`node --version`)
- [ ] Python 3.12+ (`python --version`)
- [ ] Docker running (`docker --version`)
- [ ] Supabase project created at https://app.supabase.com
- [ ] `.env` file configured with Supabase credentials

## 📋 Setup Checklist

### Backend Configuration

```bash
# 1. Copy environment template
cp .env.supabase.example .env

# 2. Edit .env and add Supabase credentials
# DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, etc.

# 3. Initialize database
python setup_supabase.py

# 4. Verify setup
python -c "from app.db.session import AsyncSessionLocal; print('✓ DB OK')"
```

### Frontend Configuration

```bash
# 1. Navigate to frontend
cd frontend

# 2. Create .env.local
echo VITE_API_URL=http://localhost:8000 > .env.local
echo VITE_SUPABASE_URL=https://[YOUR_PROJECT].supabase.co >> .env.local
echo VITE_SUPABASE_ANON_KEY=[YOUR_ANON_KEY] >> .env.local

# 3. Install dependencies
npm install
```

---

## 🎯 Typical Workflow

1. **Start Docker services** (once per session):
   ```bash
   docker-compose up -d
   ```

2. **Start backend** (auto-reloads on code changes):
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Start frontend** (hot reload on code changes):
   ```bash
   npm run dev
   ```

4. **Open browser**:
   ```
   http://localhost:5173
   ```

---

## 📊 Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 5173 | React app |
| Backend API | 8000 | FastAPI endpoints |
| Redis | 6379 | Cache & task queue |
| Flower | 5555 | Task monitoring UI |
| Supabase | N/A | Managed database (cloud) |

---

## 🔍 Verify Everything Works

### Backend Health Check
```bash
curl http://localhost:8000/docs
```
Should show Swagger UI

### Frontend Health Check
```bash
curl http://localhost:5173
```
Should return React HTML

### Database Connection
```bash
python -c "from app.db.session import AsyncSessionLocal; print('✓ Connected')"
```

### Redis Health Check
```bash
docker-compose exec redis redis-cli ping
```
Should respond: `PONG`

---

## 📁 Project Structure

```
fintech-accelerator/
├── app/                    # Backend (FastAPI)
│   ├── main.py            # Entry point
│   ├── api/v1/            # API endpoints
│   ├── models/            # Database models
│   ├── services/          # Business logic
│   ├── db/                # Database config
│   └── core/              # Config & security
├── frontend/              # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/         # Route pages
│   │   ├── components/    # React components
│   │   ├── api/           # API calls
│   │   └── store/         # State management
│   ├── vite.config.ts     # Dev server config
│   └── package.json
├── docker-compose.yml     # Services (Redis, Workers)
├── requirements.txt       # Python dependencies
├── .env                   # Backend config
└── RUN_FULL_STACK.md      # Detailed guide
```

---

## 🐛 Troubleshooting

### Frontend shows "Cannot GET /api/v1/*"
- ❌ Backend not running
- ✅ Start backend: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

### "DATABASE_URL not found" error
- ❌ `.env` file missing or incomplete
- ✅ Copy and fill `.env.supabase.example`

### Port 5173 already in use
- ❌ Another dev server running
- ✅ Use different port: `npm run dev -- --port 3000`

### Node modules error
- ❌ Corrupted node_modules
- ✅ Clear and reinstall:
  ```bash
  cd frontend
  rm -r node_modules package-lock.json
  npm install
  ```

### Docker services won't start
- ❌ Docker not running
- ✅ Start Docker Desktop or service

### "ModuleNotFoundError"
- ❌ Python dependencies not installed
- ✅ Run: `pip install -r requirements.txt`

---

## 🛑 Stopping Everything

```bash
# Stop Frontend (Ctrl+C in terminal 3)
# Stop Backend (Ctrl+C in terminal 2)
# Stop Docker services
docker-compose down
```

Or use one command:
```bash
# Clean shutdown
docker-compose down && echo "Services stopped"
```

---

## 💾 Database Queries

### View tables in Supabase
1. Go to https://app.supabase.com
2. Select your project
3. Go to **Table Editor**
4. See all tables (users, documents, onboarding, etc.)

### Query from Python
```python
from app.db.session import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select

async with AsyncSessionLocal() as session:
    users = await session.execute(select(User))
    print(users.scalars().all())
```

---

## 🚀 Next Steps

1. ✅ **Setup**: Follow setup checklist above
2. ✅ **Verify**: Run health checks
3. ✅ **Start**: Use quick start commands
4. ✅ **Develop**: Make code changes (auto-reload)
5. ✅ **Test**: Visit http://localhost:5173
6. ✅ **Deploy**: See production build guides

---

## 📚 Full Documentation

- **Full Setup**: See [RUN_FULL_STACK.md](./RUN_FULL_STACK.md)
- **Backend Config**: See [SUPABASE_README.md](./SUPABASE_README.md)
- **Migration Guide**: See [SUPABASE_MIGRATION.md](./SUPABASE_MIGRATION.md)
- **API Docs**: http://localhost:8000/docs

---

## ⚡ Commands Reference

```bash
# Backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000  # Start with auto-reload
python setup_supabase.py                                   # Initialize DB
alembic upgrade head                                       # Run migrations

# Frontend
npm run dev                                                # Start dev server
npm run build                                              # Build for production
npm run preview                                            # Preview production build

# Docker
docker-compose up -d                                       # Start services
docker-compose down                                        # Stop services
docker-compose ps                                          # Check status
docker-compose logs -f                                     # View logs

# Database
python -c "from app.db.session import AsyncSessionLocal; print('✓ OK')"  # Test connection
```

---

**Ready to start?** → Run the quick start commands above! 🎉
