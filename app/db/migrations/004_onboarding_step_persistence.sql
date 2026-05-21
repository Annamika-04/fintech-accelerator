-- Migration: add step persistence columns to onboarding_state
ALTER TABLE onboarding_state
  ADD COLUMN IF NOT EXISTS step_data        JSONB         NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_completed_step VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS submitted_at     TIMESTAMPTZ   NULL;
