-- V1.0.0__init_database.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS infra;
COMMENT ON SCHEMA infra IS 'Platform infrastructure: migrations, locks. Sprint 1.';

CREATE SCHEMA IF NOT EXISTS app;
COMMENT ON SCHEMA app IS 'Business domain tables. Empty in Sprint 1. Populated from Sprint 2.';

CREATE SCHEMA IF NOT EXISTS audit;
COMMENT ON SCHEMA audit IS 'Append-only audit/event store. Empty in Sprint 1.';

DO $$ BEGIN
  CREATE ROLE aairp_migration LOGIN PASSWORD 'CHANGE_ME';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE aairp_app LOGIN PASSWORD 'CHANGE_ME';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE aairp_readonly LOGIN PASSWORD 'CHANGE_ME';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA infra TO aairp_migration, aairp_app, aairp_readonly;
GRANT USAGE ON SCHEMA app TO aairp_migration, aairp_app, aairp_readonly;
GRANT USAGE ON SCHEMA audit TO aairp_migration, aairp_app, aairp_readonly;
