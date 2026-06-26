-- V2.0.0__knowledge_tables.sql
-- Sprint 2A — KOS (Regulation / Rule / Playbook / Prompt / Case / Review / Feedback)

CREATE TYPE app.pack_version_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- ---------------------------------------------------------------------------
-- Regulation (KOS object #1)
-- ---------------------------------------------------------------------------
CREATE TABLE app.regulation (
    regulation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regulation_key  TEXT NOT NULL,
    jurisdiction    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_regulation_key UNIQUE (regulation_key)
);

CREATE INDEX idx_regulation_jurisdiction ON app.regulation (jurisdiction);

CREATE TABLE app.regulation_version (
    regulation_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regulation_id       UUID NOT NULL REFERENCES app.regulation (regulation_id) ON DELETE CASCADE,
    version_number      INTEGER NOT NULL,
    status              app.pack_version_status NOT NULL DEFAULT 'DRAFT',
    law_name              TEXT NOT NULL,
    article               TEXT,
    source_url            TEXT,
    body_text             TEXT,
    tags_json             JSONB NOT NULL DEFAULT '[]',
    search_text           TEXT,
    published_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_regulation_version_number UNIQUE (regulation_id, version_number)
);

CREATE INDEX idx_regulation_version_status ON app.regulation_version (regulation_id, status);
CREATE INDEX idx_regulation_version_search ON app.regulation_version USING GIN (
    to_tsvector('simple', coalesce(search_text, law_name || ' ' || coalesce(article, '')))
);

-- ---------------------------------------------------------------------------
-- Rule (KOS object #2)
-- ---------------------------------------------------------------------------
CREATE TABLE app.rule_pack (
    rule_pack_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_key        TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rule_pack_key UNIQUE (pack_key)
);

CREATE TABLE app.rule_definition (
    rule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_pack_id    UUID NOT NULL REFERENCES app.rule_pack (rule_pack_id) ON DELETE CASCADE,
    rule_key        TEXT NOT NULL,
    display_name    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rule_pack_rule_key UNIQUE (rule_pack_id, rule_key)
);

CREATE INDEX idx_rule_definition_pack ON app.rule_definition (rule_pack_id);

CREATE TABLE app.rule_version (
    rule_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         UUID NOT NULL REFERENCES app.rule_definition (rule_id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    status          app.pack_version_status NOT NULL DEFAULT 'DRAFT',
    severity        TEXT NOT NULL,
    decision        TEXT NOT NULL,
    summary         TEXT NOT NULL,
    scope_json      JSONB NOT NULL DEFAULT '{}',
    payload_json    JSONB NOT NULL DEFAULT '{}',
    owner           TEXT,
    tags            JSONB NOT NULL DEFAULT '[]',
    effective_from  TIMESTAMPTZ,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rule_version_number UNIQUE (rule_id, version_number)
);

CREATE INDEX idx_rule_version_rule_status ON app.rule_version (rule_id, status);
CREATE INDEX idx_rule_version_scope ON app.rule_version USING GIN (scope_json);
CREATE INDEX idx_rule_version_search ON app.rule_version USING GIN (
    to_tsvector('simple', coalesce(summary, ''))
);

CREATE TABLE app.rule_version_regulation (
    rule_version_id         UUID NOT NULL REFERENCES app.rule_version (rule_version_id) ON DELETE CASCADE,
    regulation_version_id   UUID NOT NULL REFERENCES app.regulation_version (regulation_version_id) ON DELETE CASCADE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_rule_version_regulation PRIMARY KEY (rule_version_id, regulation_version_id)
);

-- ---------------------------------------------------------------------------
-- Playbook (KOS object #3)
-- ---------------------------------------------------------------------------
CREATE TABLE app.playbook_pack (
    playbook_pack_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_key         TEXT NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_playbook_pack_key UNIQUE (pack_key)
);

CREATE TABLE app.playbook_pack_version (
    playbook_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_pack_id  UUID NOT NULL REFERENCES app.playbook_pack (playbook_pack_id) ON DELETE CASCADE,
    version_number    INTEGER NOT NULL,
    status            app.pack_version_status NOT NULL DEFAULT 'DRAFT',
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_playbook_pack_version UNIQUE (playbook_pack_id, version_number)
);

CREATE TABLE app.playbook_pattern (
    pattern_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_version_id UUID NOT NULL REFERENCES app.playbook_pack_version (playbook_version_id) ON DELETE CASCADE,
    ref_id            TEXT NOT NULL,
    match_type        TEXT NOT NULL DEFAULT 'terms',
    terms_json        JSONB NOT NULL DEFAULT '[]',
    guidance          TEXT,
    markdown_body     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_playbook_pattern_ref UNIQUE (playbook_version_id, ref_id)
);

CREATE INDEX idx_playbook_pattern_version ON app.playbook_pattern (playbook_version_id);

-- ---------------------------------------------------------------------------
-- Prompt (KOS object #4)
-- ---------------------------------------------------------------------------
CREATE TABLE app.prompt_pack (
    prompt_pack_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_key         TEXT NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prompt_pack_key UNIQUE (pack_key)
);

CREATE TABLE app.prompt_template (
    template_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_pack_id   UUID NOT NULL REFERENCES app.prompt_pack (prompt_pack_id) ON DELETE CASCADE,
    template_key     TEXT NOT NULL,
    template_type    TEXT NOT NULL DEFAULT 'open_risk',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prompt_template_key UNIQUE (prompt_pack_id, template_key)
);

CREATE TABLE app.prompt_version (
    prompt_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id       UUID NOT NULL REFERENCES app.prompt_template (template_id) ON DELETE CASCADE,
    version_number    INTEGER NOT NULL,
    status            app.pack_version_status NOT NULL DEFAULT 'DRAFT',
    content           TEXT NOT NULL,
    schema_version    TEXT,
    tags_json         JSONB NOT NULL DEFAULT '[]',
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prompt_version_number UNIQUE (template_id, version_number)
);

CREATE INDEX idx_prompt_version_template_status ON app.prompt_version (template_id, status);
CREATE INDEX idx_prompt_version_search ON app.prompt_version USING GIN (
    to_tsvector('simple', coalesce(content, ''))
);

-- ---------------------------------------------------------------------------
-- Case (KOS object #5) — operational store (JSON payload = Case Schema 1.0)
-- ---------------------------------------------------------------------------
CREATE TABLE app.case_record (
    case_record_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id           TEXT NOT NULL,
    case_version      INTEGER NOT NULL DEFAULT 1,
    review_id         TEXT NOT NULL,
    advertisement_id  TEXT,
    lifecycle_status  TEXT NOT NULL DEFAULT 'GENERATED',
    schema_version    TEXT NOT NULL DEFAULT '1.0.0',
    tenant_id         TEXT NOT NULL DEFAULT 'demo',
    country_id        TEXT,
    platform_id       TEXT,
    category_id       TEXT,
    content_hash      TEXT,
    ai_decision       TEXT,
    final_decision    TEXT,
    payload_json      JSONB NOT NULL,
    search_text       TEXT,
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_case_record_case_id_version UNIQUE (case_id, case_version),
    CONSTRAINT uq_case_record_review_id UNIQUE (review_id)
);

CREATE INDEX idx_case_record_dimensions ON app.case_record (country_id, category_id, platform_id);
CREATE INDEX idx_case_record_lifecycle ON app.case_record (lifecycle_status, updated_at DESC);
CREATE INDEX idx_case_record_search ON app.case_record USING GIN (
    to_tsvector('simple', coalesce(search_text, ''))
);

-- ---------------------------------------------------------------------------
-- Review run index (links to reviews; optional mirror of case/review pipeline)
-- ---------------------------------------------------------------------------
CREATE TABLE app.review_run (
    review_run_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id         TEXT NOT NULL,
    advertisement_id  TEXT NOT NULL,
    tenant_id         TEXT NOT NULL DEFAULT 'demo',
    country_id        TEXT NOT NULL,
    platform_id       TEXT NOT NULL,
    category_id       TEXT NOT NULL,
    content_hash      TEXT,
    ad_text_preview   TEXT,
    ai_decision       TEXT NOT NULL,
    final_decision    TEXT NOT NULL,
    confidence        NUMERIC(5, 4) NOT NULL,
    rationale         TEXT,
    finding_counts_json JSONB NOT NULL DEFAULT '{}',
    report_html       TEXT,
    metadata_json     JSONB NOT NULL DEFAULT '{}',
    reviewed_at       TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_review_run_review_id UNIQUE (review_id)
);

CREATE INDEX idx_review_run_dimensions ON app.review_run (country_id, category_id, platform_id);
CREATE INDEX idx_review_run_decision ON app.review_run (final_decision, reviewed_at DESC);

CREATE TABLE app.review_finding_ref (
    finding_ref_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_run_id     UUID NOT NULL REFERENCES app.review_run (review_run_id) ON DELETE CASCADE,
    module            TEXT NOT NULL,
    ref_id            TEXT NOT NULL,
    severity          TEXT,
    decision          TEXT,
    summary           TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_finding_ref_run ON app.review_finding_ref (review_run_id);

-- ---------------------------------------------------------------------------
-- Feedback (KOS object #6)
-- ---------------------------------------------------------------------------
CREATE TABLE app.feedback (
    feedback_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id         TEXT,
    case_id           TEXT,
    pilot_id          TEXT,
    status            TEXT NOT NULL DEFAULT 'open',
    decision          TEXT,
    ratings_json      JSONB NOT NULL DEFAULT '{}',
    comment           TEXT,
    reviewer_id       TEXT,
    metadata_json     JSONB NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_review ON app.feedback (review_id);
CREATE INDEX idx_feedback_pilot ON app.feedback (pilot_id);
CREATE INDEX idx_feedback_case ON app.feedback (case_id);

COMMENT ON SCHEMA app IS 'KOS business domain — Sprint 2A (7 knowledge objects)';
