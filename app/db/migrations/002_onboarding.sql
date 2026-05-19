-- migrations/002_onboarding.sql

CREATE TYPE onboarding_type AS ENUM ('individual', 'corporate');

CREATE TYPE onboarding_status AS ENUM (
    'REGISTERED',
    'TYPE_SELECTED',
    'PROFILE_COMPLETED',
    'DOCUMENTS_UPLOADED',
    'KYC_PENDING',
    'AML_PENDING',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'FROZEN'
);

-- ── Individual Profiles ───────────────────────────────────────────────────────

CREATE TABLE individual_profiles (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    full_name            VARCHAR(255) NOT NULL,
    date_of_birth        DATE,
    nationality          VARCHAR(100),
    country_of_residence VARCHAR(100),
    phone                VARCHAR(50),
    email                VARCHAR(255),
    occupation           VARCHAR(150),
    tax_id               VARCHAR(100),
    address              JSONB,
    onboarding_status    onboarding_status NOT NULL DEFAULT 'PROFILE_COMPLETED',
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Corporate Profiles ────────────────────────────────────────────────────────

CREATE TABLE corporate_profiles (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    company_name         VARCHAR(255) NOT NULL,
    registration_number  VARCHAR(100),
    gstin_ein            VARCHAR(100),
    country_of_incorporation VARCHAR(100),
    industry             VARCHAR(150),
    registered_address   JSONB,
    operating_countries  JSONB,
    onboarding_status    onboarding_status NOT NULL DEFAULT 'PROFILE_COMPLETED',
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Directors / UBOs (flat list, linked to corporate profile) ─────────────────

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

-- ── Onboarding state tracking (one row per user) ──────────────────────────────

CREATE TABLE onboarding_state (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    onboarding_type   onboarding_type,
    current_status    onboarding_status NOT NULL DEFAULT 'REGISTERED',
    profile_id        UUID,
    kyc_score         INTEGER,
    aml_score         INTEGER,
    final_score       INTEGER,
    decision          VARCHAR(50),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_individual_profiles_user_id  ON individual_profiles(user_id);
CREATE INDEX idx_corporate_profiles_user_id   ON corporate_profiles(user_id);
CREATE INDEX idx_corporate_directors_corp_id  ON corporate_directors(corporate_id);
CREATE INDEX idx_onboarding_state_user_id     ON onboarding_state(user_id);
CREATE INDEX idx_onboarding_state_status      ON onboarding_state(current_status);
