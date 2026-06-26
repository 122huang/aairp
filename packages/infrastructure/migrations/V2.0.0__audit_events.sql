-- V2.0.0__audit_events.sql
-- Append-only audit store for admin mutations

CREATE TABLE audit.audit_event (
    audit_event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor             TEXT NOT NULL DEFAULT 'system',
    action            TEXT NOT NULL,
    resource_type     TEXT NOT NULL,
    resource_id       TEXT NOT NULL,
    payload_json      JSONB NOT NULL DEFAULT '{}',
    trace_id          TEXT,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_event_resource ON audit.audit_event (resource_type, resource_id);
CREATE INDEX idx_audit_event_occurred ON audit.audit_event (occurred_at DESC);

COMMENT ON TABLE audit.audit_event IS 'Append-only KOS audit log — Sprint 2A';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aairp_app') THEN
    REVOKE UPDATE, DELETE ON audit.audit_event FROM aairp_app;
  END IF;
END $$;
