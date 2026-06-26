# E6 — Feedback KOS

**Status:** Complete (2026-06-26)

## Deliverables

| Story | Item |
|-------|------|
| E6-S1 | `PgFeedbackRepository` — link `case_id` / `review_id` / `pilot_id`; status workflow `open` / `triaged` / `closed` |
| E6-S2 | `/kos/v1/feedback` CRUD + audit on create/update |
| E6-S3 | `pnpm kos:import-pilot-log` from `pilot/pilot-ad-log.csv`; idempotent upsert by `case_id` |

## API routes

| Method | Path |
|--------|------|
| GET | `/kos/v1/feedback` |
| POST | `/kos/v1/feedback` |
| GET | `/kos/v1/feedback/:feedbackId` |
| PATCH | `/kos/v1/feedback/:feedbackId` |

Query filters: `review_id`, `case_id`, `pilot_id`, `status`, `limit`, `offset`.

## Pilot import

```powershell
pnpm kos:import-pilot-log
```

Maps 9 L2 pilot rows; `DISAGREE_DECISION` → metadata `category: GAP`. Re-import updates existing rows by `case_id`.

## Validation

Ratings JSON values must be integers 1–5 (`validateFeedbackRatings`).

## Hard constraint

Feedback storage is operational only — **does not trigger Learning** or alter review pipeline.

## Next

Sprint 2A KOS operational layer complete. Runtime read from KOS → Sprint 2B.
