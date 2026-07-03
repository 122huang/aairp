-- V2.4.0__ownership_lifecycle.sql
-- Sprint 4B — KOS ownership lifecycle metadata (no runtime behavior change)

ALTER TABLE app.rule_version
    ADD COLUMN IF NOT EXISTS owner_type TEXT,
    ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS freshness_status TEXT;

ALTER TABLE app.regulation_version
    ADD COLUMN IF NOT EXISTS owner TEXT,
    ADD COLUMN IF NOT EXISTS owner_type TEXT,
    ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS freshness_status TEXT;

COMMENT ON COLUMN app.rule_version.owner_type IS 'Owner role: legal, compliance, knowledge_eng, product';
COMMENT ON COLUMN app.rule_version.last_reviewed_at IS 'Last ownership or content review timestamp';
COMMENT ON COLUMN app.rule_version.freshness_status IS 'Lifecycle freshness: current, review_due, stale, deprecated';
COMMENT ON COLUMN app.regulation_version.owner IS 'Accountable owner (email or team id)';
COMMENT ON COLUMN app.regulation_version.owner_type IS 'Owner role: legal, compliance, knowledge_eng, product';
COMMENT ON COLUMN app.regulation_version.last_reviewed_at IS 'Last ownership or content review timestamp';
COMMENT ON COLUMN app.regulation_version.freshness_status IS 'Lifecycle freshness: current, review_due, stale, deprecated';
