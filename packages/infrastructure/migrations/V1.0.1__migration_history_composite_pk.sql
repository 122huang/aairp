-- V1.0.1__migration_history_composite_pk.sql
-- Allow multiple migration files per semver (e.g. four V1.0.0__*.sql).

ALTER TABLE infra.migration_history DROP CONSTRAINT IF EXISTS pk_migration_history;
ALTER TABLE infra.migration_history ADD PRIMARY KEY (version, name);
