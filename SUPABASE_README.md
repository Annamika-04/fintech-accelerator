# Supabase Database Setup

This fintech accelerator project now uses **Supabase** as its managed PostgreSQL database, replacing the local PostgreSQL container.

## Quick Start

### 1. Get Supabase Credentials
1. Create a project at https://app.supabase.com
2. Go to Project Settings → Database
3. Copy your connection string (or build it from the connection info)
4. Get your credentials from API section

### 2. Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit .env with your Supabase credentials
# Required variables:
# - DATABASE_URL: postgres://postgres:[PASSWORD]@[HOST]/postgres
# - SUPABASE_URL: https://[PROJECT].supabase.co
# - SUPABASE_ANON_KEY: your anon key
# - SUPABASE_SERVICE_ROLE_KEY: your service role key
# - SUPABASE_JWT_SECRET: your JWT secret
```

### 3. Initialize Database
```bash
# Option A: Using the setup script
python setup_supabase.py

# Option B: Using Alembic (if migrations exist)
alembic upgrade head

# Option C: Manually run SQL migrations
# Copy content from app/db/migrations/*.sql to Supabase SQL Editor
```

### 4. Start Services
```bash
# Start all services (API, workers, Flower)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api
```

## What's Different

| Aspect | Before | After |
|--------|--------|-------|
| Database | Local PostgreSQL container | Managed Supabase |
| Connection | `localhost:5432` | `[project].supabase.co:5432` |
| Schema Init | SQL init script in docker-compose | Run setup script or migrations |
| Backups | Manual | Automatic (Supabase handles) |
| Credentials | Built into docker-compose | Environment variables |

## Key Files Changed

- **docker-compose.yml** - PostgreSQL service removed, kept Redis and workers
- **.env.example** - Updated DATABASE_URL format for Supabase
- **setup_supabase.py** - New script to initialize Supabase schema

## Database Connection

The app uses **SQLAlchemy** with **asyncpg** driver for async database access:

```python
DATABASE_URL = "postgresql+asyncpg://postgres:[password]@[host]:5432/postgres"
```

This is fully compatible with Supabase's PostgreSQL implementation.

## Authentication

Supabase Auth is used for user management:

```python
# User authentication uses Supabase Auth API
# Users are created/managed via supabase_auth service
# JWT tokens are validated against Supabase JWT secret
```

## Troubleshooting

### Connection Failed
- Verify DATABASE_URL is correct
- Check Supabase project is "Running" in dashboard
- Ensure firewall allows your IP (check Supabase Network Settings)

### Tables Not Found
- Run `python setup_supabase.py` to create tables
- Or manually execute SQL migrations from `app/db/migrations/`

### Authentication Errors
- Verify SUPABASE_SERVICE_ROLE_KEY is set correctly
- Check SUPABASE_URL format (with https://)
- Ensure JWT secret is correct

## Performance Considerations

- **Connection Pool**: 20 connections, max 40 overflow (optimized for Supabase)
- **Read Replicas**: Available on Supabase Pro+ plans
- **Caching**: Implement in Redis for frequently accessed data
- **Indexes**: Already created via SQLAlchemy models

## Production Deployment

1. Create Supabase project with sufficient plan (Pro+ recommended)
2. Enable backups and PITR (Point-In-Time Recovery)
3. Set up database user with limited permissions
4. Use connection pooler for high-concurrency scenarios
5. Monitor database metrics in Supabase dashboard

## Migration from Local PostgreSQL

If migrating existing data:

1. **Export from local database:**
   ```bash
   pg_dump -h localhost -U kyc_user kyc_db > backup.sql
   ```

2. **Import to Supabase:**
   - Use Supabase Dashboard → SQL Editor → paste SQL
   - Or use `psql` with remote connection string

3. **Verify data:**
   - Check table row counts match
   - Spot-check critical records

## References

- [Supabase Docs](https://supabase.com/docs)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [FastAPI with Databases](https://fastapi.tiangolo.com/advanced/async-sql-databases/)

---

**Ready to migrate?** See [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)
