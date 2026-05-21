-- Migration 002: Add Supabase auth columns to users table
-- Run: psql -U kyc_user -d kyc_db -f app/db/migrations/002_add_supabase_auth.sql

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS supabase_uid VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE,
    ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Make email and cognito_sub nullable (phone-based auth doesn't need them)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Drop old cognito_sub unique constraint if exists, make nullable
ALTER TABLE users ALTER COLUMN cognito_sub DROP NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
