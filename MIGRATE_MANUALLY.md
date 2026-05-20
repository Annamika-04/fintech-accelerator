# Manual Database Migration to Supabase

Since the Python script can't connect to Supabase due to network issues, you can run the migrations directly in Supabase's SQL editor.

## Steps

### 1. Open Supabase SQL Editor
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **fintech-accelerator**
3. Click **SQL Editor** (left sidebar)
4. Click **New query**

### 2. Run Migration 1: Initial Schema
Copy the entire content below and paste it into Supabase SQL editor:

```sql
-- migrations/001_initial_schema.sql
-- Run once against a fresh kyc_db database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
    'customer', 'kyc_officer', 'aml_analyst',
    'compliance_manager', 'auditor', 'admin'
);

CREATE TYPE kyc_status AS ENUM (
    'pending', 'in_review', 'approved', 'rejected', 'escalated'
);

CREATE TYPE risk_decision AS ENUM (
    'AUTO_APPROVE', 'MANUAL_REVIEW', 'COMPLIANCE_ESCALATION', 'AUTO_REJECT'
);

-- ── Core Tables ──────────────────────────────────────────────────────────────

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_uid    VARCHAR(255) UNIQUE,
    email           VARCHAR(255) UNIQUE,
    phone_number    VARCHAR(20) UNIQUE,
    phone_verified  BOOLEAN DEFAULT FALSE,
    role            user_role NOT NULL DEFAULT 'customer',
    is_active       BOOLEAN DEFAULT TRUE,
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE individual_profiles (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name               VARCHAR(255) NOT NULL,
    date_of_birth           DATE,
    nationality             VARCHAR(100),
    country_of_residence    VARCHAR(100),
    phone                   VARCHAR(50),
    email                   VARCHAR(255),
    occupation              VARCHAR(150),
    tax_id                  VARCHAR(100),
    address                 JSONB,
    onboarding_status       VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE corporate_profiles (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_name                VARCHAR(255) NOT NULL,
    registration_number         VARCHAR(100),
    gstin_ein                   VARCHAR(100),
    country_of_incorporation    VARCHAR(100),
    industry                    VARCHAR(150),
    registered_address          JSONB,
    operating_countries         JSONB,
    onboarding_status           VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE corporate_directors (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    corporate_id      UUID REFERENCES corporate_profiles(id) ON DELETE CASCADE,
    full_name         VARCHAR(255) NOT NULL,
    role              VARCHAR(100),
    ownership_pct     DECIMAL(5,2) DEFAULT 0,
    is_ubo            BOOLEAN DEFAULT FALSE,
    nationality       VARCHAR(100),
    date_of_birth     DATE,
    id_document_type  VARCHAR(50),
    id_document_ref   VARCHAR(255),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_state (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    onboarding_type   VARCHAR(50),
    current_status    VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
    profile_id        UUID,
    kyc_score         INTEGER,
    aml_score         INTEGER,
    final_score       INTEGER,
    decision          VARCHAR(50),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
    document_type           VARCHAR(50) NOT NULL,
    s3_key                  VARCHAR(500) NOT NULL,
    s3_bucket               VARCHAR(255) NOT NULL,
    file_hash               VARCHAR(64),
    mime_type               VARCHAR(100),
    file_size_bytes         BIGINT,
    is_encrypted            BOOLEAN DEFAULT TRUE,
    virus_scan_status       VARCHAR(50) DEFAULT 'pending',
    upload_status           VARCHAR(50) DEFAULT 'uploaded',
    full_name               VARCHAR(255),
    s3_url                  TEXT,
    verification_status     VARCHAR(50) DEFAULT 'pending',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_verifications (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id             UUID REFERENCES documents(id),
    user_id                 UUID REFERENCES users(id),
    extracted_fields        JSONB,
    confidence_scores       JSONB,
    textract_job_id         VARCHAR(255),
    verification_status     VARCHAR(50) DEFAULT 'pending',
    reviewed_by             UUID REFERENCES users(id),
    reviewed_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE face_verifications (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID REFERENCES users(id),
    selfie_s3_key           VARCHAR(500),
    id_document_s3_key      VARCHAR(500),
    similarity_score        DECIMAL(5,2),
    confidence_score        DECIMAL(5,2),
    is_match                BOOLEAN,
    rekognition_response    JSONB,
    status                  VARCHAR(50) DEFAULT 'pending',
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE aml_screenings (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID REFERENCES users(id),
    profile_type            VARCHAR(20),
    normalized_name         VARCHAR(255),
    screening_provider      VARCHAR(100),
    is_pep                  BOOLEAN DEFAULT FALSE,
    is_sanctioned           BOOLEAN DEFAULT FALSE,
    adverse_media_flag      BOOLEAN DEFAULT FALSE,
    match_details           JSONB,
    risk_flags              JSONB,
    screened_at             TIMESTAMPTZ DEFAULT NOW(),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk_scores (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID REFERENCES users(id),
    kyc_risk                    INTEGER DEFAULT 0,
    aml_risk                    INTEGER DEFAULT 0,
    geographic_risk             INTEGER DEFAULT 0,
    behavioural_risk            INTEGER DEFAULT 0,
    transaction_risk            INTEGER DEFAULT 0,
    device_ip_risk              INTEGER DEFAULT 0,
    ownership_structure_risk    INTEGER DEFAULT 0,
    final_score                 INTEGER NOT NULL,
    decision                    VARCHAR(50) NOT NULL,
    score_breakdown             JSONB,
    calculated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    case_type       VARCHAR(50),
    status          VARCHAR(50) DEFAULT 'open',
    priority        VARCHAR(20) DEFAULT 'medium',
    assigned_to     UUID REFERENCES users(id),
    risk_score_id   UUID REFERENCES risk_scores(id),
    notes           TEXT,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id        UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     UUID,
    ip_address      INET,
    user_agent      TEXT,
    extra_metadata  JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    alert_type      VARCHAR(100) NOT NULL,
    severity        VARCHAR(20) NOT NULL,
    message         TEXT,
    is_resolved     BOOLEAN DEFAULT FALSE,
    resolved_by     UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_users_supabase_uid        ON users(supabase_uid);
CREATE INDEX idx_users_email               ON users(email);
CREATE INDEX idx_users_phone               ON users(phone_number);
CREATE INDEX idx_documents_user_id         ON documents(user_id);
CREATE INDEX idx_doc_verif_document_id     ON document_verifications(document_id);
CREATE INDEX idx_face_verif_user_id        ON face_verifications(user_id);
CREATE INDEX idx_aml_screenings_user_id    ON aml_screenings(user_id);
CREATE INDEX idx_risk_scores_user_id       ON risk_scores(user_id);
CREATE INDEX idx_cases_assigned_to         ON cases(assigned_to);
CREATE INDEX idx_cases_status              ON cases(status);
CREATE INDEX idx_audit_logs_actor_id       ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at     ON audit_logs(created_at DESC);
CREATE INDEX idx_alerts_user_id            ON alerts(user_id);
CREATE INDEX idx_documents_verification_status ON documents(verification_status);
CREATE INDEX idx_documents_s3_key          ON documents(s3_key);
CREATE INDEX idx_individual_profiles_user_id   ON individual_profiles(user_id);
CREATE INDEX idx_corporate_profiles_user_id    ON corporate_profiles(user_id);
CREATE INDEX idx_corporate_directors_corp_id   ON corporate_directors(corporate_id);
CREATE INDEX idx_onboarding_state_user_id      ON onboarding_state(user_id);
CREATE INDEX idx_onboarding_state_status       ON onboarding_state(current_status);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER set_updated_at_documents
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER set_updated_at_cases
    BEFORE UPDATE ON cases
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
```

Click **Run** button (or Ctrl+Enter)

### 3. Verify Migration 1
You should see a success message. Check that all tables are created:

1. Click **Data** (left sidebar)
2. Expand the list - you should see: users, documents, individual_profiles, etc.

### 4. Summary
All 4 migrations are now combined into one complete schema above. Run it once and your database is ready.

## Troubleshooting

**Error: "Table 'users' already exists"**
- Your database already has some tables. That's okay, the code uses CREATE TABLE IF NOT EXISTS logic.
- You can drop and recreate: Click **SQL Editor** → **New query** and run:
  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```
- Then run the full migration again.

**Error: "Connection failed"**
- Check your internet connection
- Verify Supabase dashboard is accessible
- Try again in 5 minutes

**Success!**
Once migrations complete, all tables are ready. Your backend can now connect and use the database.
