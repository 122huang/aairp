-- V1.0.0__create_schema_lock.sql

CREATE TABLE infra.schema_lock (
    lock_name   VARCHAR(64)  NOT NULL,
    locked_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    locked_by   VARCHAR(128) NOT NULL,

    CONSTRAINT pk_schema_lock PRIMARY KEY (lock_name),
    CONSTRAINT ck_schema_lock_name
        CHECK (lock_name ~ '^[a-z][a-z0-9_]{0,63}$')
);

COMMENT ON TABLE infra.schema_lock IS
    'Advisory migration lock persisted for multi-replica deploy. Optional in S1 local/CI.';
