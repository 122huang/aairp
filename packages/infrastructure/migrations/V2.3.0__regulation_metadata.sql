-- V2.3.0__regulation_metadata.sql
-- Sprint 3 — optional regulation metadata (no runtime behavior change)

ALTER TABLE app.regulation_version
    ADD COLUMN IF NOT EXISTS effective_date DATE,
    ADD COLUMN IF NOT EXISTS mandatory BOOLEAN,
    ADD COLUMN IF NOT EXISTS risk_level TEXT;

COMMENT ON COLUMN app.regulation_version.effective_date IS 'Optional effective date for display and audit';
COMMENT ON COLUMN app.regulation_version.mandatory IS 'Optional flag: mandatory vs optional requirement';
COMMENT ON COLUMN app.regulation_version.risk_level IS 'Optional risk level label (e.g. HIGH, MEDIUM, LOW)';
