-- Sprint 2C — case semantic embeddings (JSONB vectors; pgvector upgrade optional later)
CREATE TABLE IF NOT EXISTS app.case_embedding (
    case_embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id           TEXT NOT NULL,
    case_version      INTEGER NOT NULL,
    embedding_model   TEXT NOT NULL,
    embedding_json    JSONB NOT NULL,
    embed_text        TEXT NOT NULL,
    dimensions        INTEGER NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_case_embedding UNIQUE (case_id, case_version, embedding_model)
);

CREATE INDEX IF NOT EXISTS idx_case_embedding_model_case
    ON app.case_embedding (embedding_model, case_id);
