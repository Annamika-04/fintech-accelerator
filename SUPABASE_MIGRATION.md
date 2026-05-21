# PostgreSQL to Supabase Migration Guide

This project has been migrated to use Supabase as the managed database instead of a local PostgreSQL container.

## What Changed

### 1. Docker Compose
- **Removed**: Local PostgreSQL (db) service
- **Kept**: Redis, FastAPI app, Celery workers, Flower
- All services now use Supabase for database operations instead of local PostgreSQL

### 2. Environment Configuration
- Update your `.env` file with Supabase connection details:

```env
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@[SUPABASE_HOST]/postgres
```

## Setup Instructions

### 1. Create Supabase Project
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Create a new project
3. Wait for project to initialize
4. Navigate to Project Settings → Database

### 2. Get Connection Details
In Supabase Dashboard:
1. Go to **Settings** → **Database**
2. Find your connection string under "Connection info"
3. Copy the connection string in the format:
   ```
   postgresql://postgres:[password]@[host]:[port]/postgres
   ```

### 3. Configure Environment
Update `.env` with your Supabase details:

```env
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@[SUPABASE_HOST]:5432/postgres
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

### 4. Run Database Migrations
```bash
# Apply Alembic migrations to Supabase
alembic upgrade head
```

Or if creating tables from scratch:
```bash
# Create all tables from SQLAlchemy models
python -c "from app.db.base import engine; from app.db.session import AsyncSessionLocal; import asyncio; asyncio.run(engine.begin())"
```

### 5. Start Services
```bash
docker-compose up -d
```

## Architecture Notes

- **SQLAlchemy ORM**: Unchanged - still uses SQLAlchemy with asyncpg
- **Connection Pool**: Configured for Supabase (20 pool size, 40 max overflow)
- **Async Support**: All database operations remain async via asyncpg
- **Authentication**: Supabase Auth is used for user management
- **Storage**: S3 integration unchanged

## Removed Dependencies

- Local PostgreSQL container no longer required
- Docker volume for `postgres_data` removed
- No local database initialization SQL needed

## Benefits

✅ Managed PostgreSQL without local infrastructure  
✅ Built-in authentication with Supabase Auth  
✅ Real-time subscriptions available  
✅ Automatic backups and point-in-time recovery  
✅ Row-level security policies supported  

## Troubleshooting

### Connection Issues
- Verify Supabase project is in Running state
- Check that password and host are correct in DATABASE_URL
- Ensure your IP is allowed (check Supabase firewall settings if applicable)

### Model Sync Issues
If tables don't exist, run migrations:
```bash
alembic upgrade head
```

### Schema Initialization
To initialize schema without migrations:
```python
from app.db.base import Base, engine
from sqlalchemy import text

async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)
```

## Migration from Local PostgreSQL

If you have existing data in local PostgreSQL:

1. Export data from local PostgreSQL:
   ```bash
   pg_dump -h localhost -U kyc_user kyc_db > backup.sql
   ```

2. Import to Supabase (via Supabase Dashboard or pg_restore)

3. Verify data integrity after migration

## Next Steps

- Update CI/CD pipelines to remove PostgreSQL service
- Configure Supabase backups (via Supabase Dashboard)
- Set up Row-Level Security policies for data isolation
- Monitor database performance via Supabase Dashboard
