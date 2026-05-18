# RUNBOOK — Exact Commands to Start the Platform
# Run these IN ORDER from your project root: c:\Users\OneData\Documents\Fintech_base

# ─────────────────────────────────────────────────────────────────────────────
# PREREQUISITE: Docker Desktop must be running
# Download: https://www.docker.com/products/docker-desktop/
# ─────────────────────────────────────────────────────────────────────────────

# STEP 1 — Fill your .env file first
# Open .env and replace all REPLACE_WITH_YOUR_* values with real AWS values

# STEP 2 — Build and start all services
docker-compose up --build

# Wait for this output:
#   api_1        | INFO:     Application startup complete.
#   worker_ocr_1 | celery@ocr ready.
#   worker_aml_1 | celery@aml ready.

# STEP 3 — In a NEW terminal, verify everything is up
docker-compose ps

# Expected: all services show "Up" or "healthy"

# STEP 4 — Check API is responding
curl http://localhost:8000/health
# Expected: {"status":"healthy","env":"development"}

# STEP 5 — Open Swagger UI in browser
# http://localhost:8000/docs

# STEP 6 — Open Flower (Celery monitoring) in browser
# http://localhost:5555

# STEP 7 — Run smoke tests
pip install httpx
python test_smoke.py

# ─────────────────────────────────────────────────────────────────────────────
# USEFUL COMMANDS
# ─────────────────────────────────────────────────────────────────────────────

# View live logs from API only
docker-compose logs -f api

# View Celery worker logs
docker-compose logs -f worker_ocr worker_aml worker_face worker_ai

# Restart just the API (after code changes)
docker-compose restart api

# Stop everything
docker-compose down

# Stop and wipe database (fresh start)
docker-compose down -v

# Connect to PostgreSQL directly
docker-compose exec db psql -U kyc_user -d kyc_db

# Check tables were created
# Inside psql: \dt

# ─────────────────────────────────────────────────────────────────────────────
# IF SOMETHING FAILS
# ─────────────────────────────────────────────────────────────────────────────

# API won't start?
docker-compose logs api
# Look for: ImportError, missing env var, DB connection refused

# Workers not connecting?
docker-compose logs worker_ocr
# Look for: redis connection refused → check REDIS_URL in .env

# Database tables missing?
docker-compose down -v
docker-compose up --build
# The SQL migration runs automatically on first start

# AWS errors (S3/Textract/Rekognition)?
# Check: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env are correct
# Check: AWS_REGION matches the region of your S3 bucket and Cognito pool
