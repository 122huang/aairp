-- Allow multiple case versions per case_id (amend); review_id idempotency enforced in app layer.
ALTER TABLE app.case_record DROP CONSTRAINT IF EXISTS uq_case_record_review_id;

CREATE INDEX IF NOT EXISTS idx_case_record_review_id ON app.case_record (review_id);
