# KOS Audit Policy

**Status:** Sprint 2A (E7)  
**Store:** PostgreSQL schema `audit.audit_event`

## Purpose

Append-only audit trail for all KOS operational writes (create, update, publish, rollback, archive, import). Read-only query via `/kos/v1/audit-events*`.

## Event shape

| Field | Description |
|-------|-------------|
| `audit_event_id` | UUID primary key |
| `actor` | From `X-Kos-Actor` header or `system` |
| `action` | e.g. `CREATE`, `UPDATE`, `PUBLISH`, `ROLLBACK`, `ARCHIVE` |
| `resource_type` | e.g. `rule_version`, `feedback`, `case_record` |
| `resource_id` | Target entity id |
| `payload_json` | Structured context (version numbers, keys, etc.) |
| `trace_id` | Request trace id when available |
| `occurred_at` | UTC timestamp |

## Immutability

- `aairp_app` role: **SELECT + INSERT only** (no UPDATE/DELETE on `audit.audit_event`)
- Migrations enforce `REVOKE UPDATE, DELETE` on audit table
- Corrections are new events, never in-place edits

## Retention

| Tier | Default | Notes |
|------|---------|-------|
| Hot query | 365 days | Operational lookup via KOS API |
| Cold archive | TBD | Export CSV before purge; Sprint 2B+ |

No automatic purge in Sprint 2A — ops exports periodically via `GET /kos/v1/audit-events/export?format=csv`.

## Query API

```
GET /kos/v1/audit-events?resource_type=rule_version&resource_id=<uuid>
GET /kos/v1/audit-events/:auditEventId
GET /kos/v1/audit-events/export?format=csv&from=2026-01-01T00:00:00.000Z
```

Filters: `resource_type`, `resource_id`, `action`, `trace_id`, `from`, `to`, `limit`, `offset`.

Export capped at 10,000 rows per request (`AUDIT_EXPORT_MAX_ROWS`).

## Traceability

Every `KosPublishService.publish` / `rollback` writes `PUBLISH` or `ROLLBACK` in the same transaction as version status changes. Admin services write `CREATE` / `UPDATE` for CRUD operations.

## Access

| Role | Read | Write |
|------|------|-------|
| `aairp_app` (API) | Yes | Insert only |
| `aairp_readonly` | Yes | No |
| `aairp_migration` | Yes | Insert (migrations) |
