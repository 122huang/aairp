-- V1.0.0__create_migration_history.sql

CREATE TABLE infra.migration_history (
    version         VARCHAR(32)   NOT NULL,
    name            VARCHAR(255)  NOT NULL,
    checksum        CHAR(64)      NOT NULL,
    applied_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    applied_by      VARCHAR(128)  NOT NULL DEFAULT CURRENT_USER,
    execution_time_ms INTEGER     NOT NULL,
    success         BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_migration_history PRIMARY KEY (version, name),
    CONSTRAINT ck_migration_history_version_format
        CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+(__[a-z0-9_]+)?$'),
    CONSTRAINT ck_migration_history_checksum_hex
        CHECK (checksum ~ '^[a-f0-9]{64}$'),
    CONSTRAINT ck_migration_history_execution_time_non_negative
        CHECK (execution_time_ms >= 0)
);

COMMENT ON TABLE infra.migration_history IS
    'Flyway-style migration audit log. One row per successfully applied version.';

CREATE INDEX idx_migration_history_applied_at
    ON infra.migration_history (applied_at DESC);
