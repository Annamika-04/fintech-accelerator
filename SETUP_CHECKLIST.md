# Setup Checklist - Fintech Accelerator

## ✅ Prerequisites
- Python 3.12+
- PostgreSQL (via Supabase)
- Redis (via Upstash or local)

## 📋 Step 1: Environment Setup

### 1.1 Copy .env from template
```bash
copy .env.example .env
```

### 1.2 Configure Database
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `fintech-accelerator`
3. Click **Settings** → **Database** (bottom left)
4. Find **Database password** section
5. Click **"Reveal password"** or **"Reset password"**
6. Copy your password (e.g., `Fintech@onedata`)

### 1.3 Update DATABASE_URL in .env
Format:
```env
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@db.hrkfafbihexdwfovguzd.supabase.co:5432/postgres
```

Replace `[PASSWORD]` with your actual password.

**Important:** The `@` symbol MUST be URL-encoded as `%40`:
- ✅ Correct: `Fintech%40onedata`
- ❌ Wrong: `Fintech@onedata`

### 1.4 Update other Supabase keys
From the same Supabase dashboard → Settings → API:
```env
SUPABASE_URL=https://hrkfafbihexdwfovguzd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=67Xcuk7kDHGuhRv7YaAoMLSZo85gHwHng8LzRsbaOPGcw0c4L6nzZ+7Qngmg2ueLGxA5U8odU+0uWrksD403uw==
```

### 1.5 Configure AWS & Redis (Optional)
If using AWS S3 or Redis, update:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>

REDIS_URL=rediss://default:<password>@<host>:6379
REDIS_URL_CELERY=rediss://default:<password>@<host>:6379?ssl_cert_reqs=CERT_NONE
```

## 🚀 Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

## 🗄️ Step 3: Database Migrations

```bash
# Apply all migrations to Supabase
alembic upgrade head
```

## 🏃 Step 4: Run Backend

### Option 1: Direct Python
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Option 2: PowerShell Script (Windows)
```bash
.\start-backend.ps1
```

## ✅ Step 5: Test OTP Flow

### Test 1: Send OTP
```bash
curl -X POST http://localhost:8000/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP sent to +919876543210. (Demo: check logs for OTP code)"
}
```

### Test 2: Verify OTP
```bash
curl -X POST http://localhost:8000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}'
```

**Expected Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid...",
    "phone": "+919876543210",
    "role": "customer"
  },
  "onboarding_status": "REGISTERED"
}
```

## 🔒 Security Notes

⚠️ **NEVER commit `.env` to git**
- `.env` is in `.gitignore` and should stay local
- If credentials are leaked, immediately rotate them in Supabase
- Use environment variables in production (GitHub Secrets, AWS Secrets Manager, etc.)

## 🐛 Troubleshooting

### Error: `socket.gaierror: [Errno 11001] getaddrinfo failed`
- **Cause:** Can't reach Supabase servers
- **Fix:** Check internet connectivity, verify DATABASE_URL is correct

### Error: `FATAL: password authentication failed`
- **Cause:** Wrong database password
- **Fix:** Reset password in Supabase Settings → Database, update .env

### Error: `FATAL: remaining connection slots are reserved for non-replication superuser connections`
- **Cause:** Connection pool limit reached
- **Fix:** Reduce `pool_size` in `app/db/session.py` or restart the backend

## 📚 Docs
- [Supabase Docs](https://supabase.com/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
