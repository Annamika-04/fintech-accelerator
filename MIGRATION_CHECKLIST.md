# PostgreSQL to Supabase Migration Checklist

## Pre-Migration
- [ ] Backup current PostgreSQL database (if you have production data)
- [ ] Create Supabase account at https://supabase.com
- [ ] Create new Supabase project
- [ ] Wait for project initialization to complete

## Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Add Supabase connection details to `.env`:
  - [ ] `DATABASE_URL` - Get from Supabase Dashboard → Settings → Database
  - [ ] `SUPABASE_URL` - Project URL
  - [ ] `SUPABASE_ANON_KEY` - API Keys section
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` - API Keys section
  - [ ] `SUPABASE_JWT_SECRET` - From JWT Settings

## Database Setup
- [ ] Verify Docker is installed and running
- [ ] Start Redis container: `docker run -d -p 6380:6379 redis:7-alpine`
- [ ] Initialize Supabase schema: `python setup_supabase.py`
  - OR manually run migrations: `alembic upgrade head`
- [ ] Verify tables created in Supabase Dashboard → Table Editor

## Services
- [ ] Stop any running PostgreSQL container
- [ ] Update `.env` with all Supabase credentials
- [ ] Start services: `docker-compose up -d`
- [ ] Verify API is running: `curl http://localhost:8000/docs`
- [ ] Check Redis is healthy: `docker-compose exec redis redis-cli ping`
- [ ] Verify workers are running: `docker-compose logs worker_*`

## Testing
- [ ] Test user registration endpoint
- [ ] Test user login with Supabase auth
- [ ] Verify data is stored in Supabase (check Dashboard)
- [ ] Test document upload functionality
- [ ] Test onboarding flow
- [ ] Verify Celery tasks are working (check Flower at http://localhost:5555)

## Frontend (if applicable)
- [ ] Update frontend `.env` with Supabase URL and anon key
- [ ] Test authentication flow
- [ ] Verify no direct PostgreSQL references in frontend code

## Cleanup
- [ ] Remove local PostgreSQL container(s)
- [ ] Update documentation for new team members
- [ ] Update CI/CD pipelines (remove PostgreSQL service)
- [ ] Delete `app/db/migrations/001_initial_schema.sql` volume mount from docker-compose.yml (done)

## Post-Migration
- [ ] Monitor Supabase dashboard for connection health
- [ ] Set up database backups (enable in Supabase Settings)
- [ ] Enable Read Replicas if needed (Supabase Pro plan+)
- [ ] Configure database user roles and permissions if needed
- [ ] Set up Row-Level Security (RLS) policies for data isolation

## Verification
- [ ] All API endpoints working
- [ ] All Celery workers processing tasks
- [ ] Database queries returning expected data
- [ ] No connection pool exhaustion errors
- [ ] Authentication flow complete
- [ ] No PostgreSQL localhost references in logs

## Optional Enhancements
- [ ] Enable Supabase Realtime subscriptions
- [ ] Set up database webhooks
- [ ] Configure auto-scaling (if using Supabase Pro)
- [ ] Enable column-level encryption for sensitive data
- [ ] Set up monitoring alerts

## Rollback Plan (if needed)
If you need to rollback:
1. Keep backup of local PostgreSQL data
2. Restore from backup if issues occur
3. Update `.env` to point back to local PostgreSQL
4. Restart docker-compose

---

**Status**: Ready for migration  
**Last Updated**: 2026-05-20  
**PostgreSQL Dependency**: Fully Removed
