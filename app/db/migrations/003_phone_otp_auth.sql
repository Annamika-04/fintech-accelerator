-- migrations/003_phone_otp_auth.sql
-- Adds phone-based OTP authentication support

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Allow supabase_uid to be nullable for phone-only users
ALTER TABLE users
  ALTER COLUMN supabase_uid DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
