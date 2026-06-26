# E7 — Audit Log KOS

**Status:** Complete (2026-06-26)

## Deliverables

| Story | Item |
|-------|------|
| E7-S1 | Write spine already in E0-S5 — all Kos*AdminService + `KosPublishService` record audit |
| E7-S2 | `GET /kos/v1/audit-events*` + CSV export |
| E7-S3 | [audit-policy.md](../audit-policy.md) — immutability, retention, access |

## API routes

| Method | Path |
|--------|------|
| GET | `/kos/v1/audit-events` |
| GET | `/kos/v1/audit-events/:auditEventId` |
| GET | `/kos/v1/audit-events/export?format=csv` |

Query filters: `resource_type`, `resource_id`, `action`, `trace_id`, `from`, `to`, `limit`, `offset`.

## Export

CSV attachment, max 10,000 rows per request.

## DoD checklist

- [x] Publish/rollback traced via `audit_event_id` (same transaction in `PgKosPublishRepository`)
- [x] `aairp_app` cannot DELETE audit rows (migration grants + REVOKE)
- [x] Read-only audit API — no write endpoints on `/audit-events`

## Sprint 2A complete

All 7 KOS objects (Regulation, Rule, Playbook, Prompt, Case, Feedback, Audit) have operational APIs under `/kos/v1/*`.
