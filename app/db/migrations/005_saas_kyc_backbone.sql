-- 005_saas_kyc_backbone.sql
-- Multi-tenant KYC backbone for resumable onboarding and traceable storage.

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(120) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    settings JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

CREATE TABLE IF NOT EXISTS kyc_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    onboarding_id VARCHAR(80) NOT NULL UNIQUE,
    current_step VARCHAR(80) NOT NULL DEFAULT 'account_type',
    status VARCHAR(80) NOT NULL DEFAULT 'registered',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    failure_reason TEXT,
    session_context JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kyc_sessions_tenant_id ON kyc_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_user_id ON kyc_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_active ON kyc_sessions(user_id, is_active);

CREATE TABLE IF NOT EXISTS kyc_step_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    kyc_session_id UUID NOT NULL REFERENCES kyc_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    step_code VARCHAR(80) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    payload_snapshot JSONB,
    last_error_code VARCHAR(80),
    last_error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_step_states_session_step
    ON kyc_step_states(kyc_session_id, step_code);

CREATE TABLE IF NOT EXISTS workflow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(120) NOT NULL,
    event_status VARCHAR(40) NOT NULL DEFAULT 'pending',
    correlation_id VARCHAR(120),
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_tenant_created ON workflow_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_events_status ON workflow_events(event_status, created_at);

ALTER TABLE onboarding_state
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;

ALTER TABLE individual_profiles
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;

ALTER TABLE corporate_profiles
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;

ALTER TABLE corporate_directors
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS onboarding_id VARCHAR(80),
    ADD COLUMN IF NOT EXISTS document_side VARCHAR(50),
    ADD COLUMN IF NOT EXISTS document_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE face_verifications
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;

ALTER TABLE aml_screenings
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;

ALTER TABLE risk_scores
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;

ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;

ALTER TABLE alerts
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL;
