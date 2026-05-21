# 🚀 Quick Start - Frontend & Backend

## TL;DR - Start Everything in 3 Steps

### Step 1: Configure Environment
```bash
# Navigate to project root
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator

# Copy and edit environment file
copy .env.supabase.example .env

# Edit .env with your Supabase credentials:
# - DATABASE_URL (from Supabase Settings → Database)
# - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### Step 2: Run Services (3 Terminals)

**Terminal 1 - Docker Services:**
```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator
docker-compose up -d
```

**Terminal 2 - Backend API:**
```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 3 - Frontend:**
```bash
cd d:\One\ Data\ Solution\Final\ Fintech\fintech-accelerator\frontend
npm install
npm run dev
```

### Step 3: Open Browser
- **Frontend**: http://localhost:5173
- **Backend Docs**: http://localhost:8000/docs
- **Task Monitor**: http://localhost:5555

---

## ✨ What's Running?

| Service | Port | Status |
|---------|------|--------|
| React Frontend | 5173 | ✅ http://localhost:5173 |
| FastAPI Backend | 8000 | ✅ http://localhost:8000/docs |
| Redis Cache | 6379 | ✅ Running in Docker |
| Celery Workers | - | ✅ OCR, Face, AML, AI |
| Flower Monitor | 5555 | ✅ http://localhost:5555 |
| Supabase DB | Cloud | ✅ Managed database |

---

## 🎯 First Test - Registration Flow

1. **Open**: http://localhost:5173
2. **Create Account** (or login)
3. **Check API**: http://localhost:8000/docs
   - Try `/auth/me` endpoint
   - Try other endpoints

---

## 📁 Important Files

```
fintech-accelerator/
├── .env                          ← EDIT THIS (Supabase credentials)
├── .env.supabase.example         ← Template for credentials
├── docker-compose.yml            ← Services config (Redis, Workers)
├── requirements.txt              ← Python dependencies
├── app/main.py                   ← Backend entry point
├── app/api/v1/                   ← API endpoints
├── app/models/                   ← Database models
├── frontend/src/                 ← React components
├── FRONTEND_BACKEND_GUIDE.md     ← Detailed setup guide
├── RUN_FULL_STACK.md             ← Full documentation
└── QUICK_START.md                ← This file
```

---

## 🔑 Configuration Quick Reference

### Backend (.env)
```env
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@[HOST]/postgres
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
AWS_ACCESS_KEY_ID=[AWS_KEY]
AWS_SECRET_ACCESS_KEY=[AWS_SECRET]
S3_BUCKET_NAME=kyc-documents-prod
```

### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://[PROJECT].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON_KEY]
```

---

## ⚠️ Common Issues

### "Cannot connect to database"
→ Check `DATABASE_URL` in `.env` is correct

### "404 /api/v1/*"
→ Backend not running, check Terminal 2

### "Supabase connection refused"
→ Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local`

### "Port already in use"
→ Close other apps using port 5173 or 8000

### "npm: command not found"
→ Install Node.js from https://nodejs.org

### "python: command not found"
→ Install Python from https://python.org

---

## 🛑 Stop Everything

```bash
# Frontend: Ctrl+C in Terminal 3
# Backend: Ctrl+C in Terminal 2
# Docker: In Terminal 1 or any terminal:
docker-compose down
```

---

## 📖 Next Steps

- **Read**: [FRONTEND_BACKEND_GUIDE.md](./FRONTEND_BACKEND_GUIDE.md) for detailed setup
- **Explore**: [RUN_FULL_STACK.md](./RUN_FULL_STACK.md) for architecture
- **API Docs**: http://localhost:8000/docs (interactive)
- **Code**: Start in `frontend/src/` or `app/api/v1/`

---

## 💡 Pro Tips

✅ Use **VSCode** or **PyCharm** for better development  
✅ Keep terminals organized or use **tmux/PowerShell tabs**  
✅ Check **Flower UI** (http://localhost:5555) for background tasks  
✅ Frontend **auto-reloads** on code changes  
✅ Backend **auto-reloads** with `--reload` flag  

---

**All set?** Open http://localhost:5173 and start building! 🎉
