-- V1.0.0__grants.sql

GRANT SELECT, INSERT, UPDATE, DELETE ON infra.migration_history TO aairp_migration;
GRANT SELECT ON infra.migration_history TO aairp_app, aairp_readonly;

GRANT ALL ON infra.schema_lock TO aairp_migration;
GRANT SELECT ON infra.schema_lock TO aairp_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA app
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aairp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app
    GRANT SELECT ON TABLES TO aairp_readonly;
