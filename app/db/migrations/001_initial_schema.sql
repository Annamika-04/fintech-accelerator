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
    supabase_uid    VARCHAR(255) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    role            user_role NOT NULL DEFAULT 'customer',
    is_active       BOOLEAN DEFAULT TRUE,
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE individual_profiles (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
    full_name               VARCHAR(255) NOT NULL,
    date_of_birth           DATE,
    nationality             VARCHAR(100),
    country_of_residence    VARCHAR(100),
    phone                   VARCHAR(50),
    address                 JSONB,
    kyc_status              kyc_status DEFAULT 'pending',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE corporate_profiles (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name            VARCHAR(255) NOT NULL,
    registration_number     VARCHAR(100),
    jurisdiction            VARCHAR(100),
    incorporation_date      DATE,
    beneficial_owners       JSONB,
    kyc_status              kyc_status DEFAULT 'pending',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    document_type       VARCHAR(50) NOT NULL,
    s3_key              VARCHAR(500) NOT NULL,
    s3_bucket           VARCHAR(255) NOT NULL,
    file_hash           VARCHAR(64),
    mime_type           VARCHAR(100),
    file_size_bytes     BIGINT,
    is_encrypted        BOOLEAN DEFAULT TRUE,
    virus_scan_status   VARCHAR(50) DEFAULT 'pending',
    upload_status       VARCHAR(50) DEFAULT 'uploaded',
    created_at          TIMESTAMPTZ DEFAULT NOW()
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
    decision                    risk_decision NOT NULL,
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
