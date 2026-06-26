# E5 — Case KOS

**Status:** Complete (2026-06-26)

## Deliverables

| Story | Item |
|-------|------|
| E5-S1 | `PgCaseKosRepository` + `ICaseKosRepository`; migration `V2.0.1` drops `review_id` unique for multi-version amend |
| E5-S2 | `/kos/v1/cases*` search/detail/export/versions; `/admin/cases*` deprecated with `Deprecation` header |
| E5-S3 | `AAIRP_CASE_STORAGE=json|kos|dual`; `DualWriteCaseStore`; `pnpm kos:import-cases` |
| E5-S4 | Lifecycle: `confirm` → CONFIRMED, `archive` → ARCHIVED, `rollback` → new version from target snapshot |

## API routes

| Method | Path |
|--------|------|
| GET | `/kos/v1/cases` |
| GET | `/kos/v1/cases/export` |
| GET | `/kos/v1/cases/:caseId` |
| GET | `/kos/v1/cases/:caseId/versions` |
| POST | `/kos/v1/cases/:caseId/confirm` |
| POST | `/kos/v1/cases/:caseId/archive` |
| POST | `/kos/v1/cases/:caseId/rollback` |

Search facets: `country_id`, `category_id`, `platform_id`, `ai_decision`, `final_decision`, `lifecycle_status`, `review_id`, `content_hash`, `language`.

## Storage modes

| `AAIRP_CASE_STORAGE` | Auto Save | Read path |
|----------------------|-----------|-----------|
| `json` (default) | JSON only | JSON |
| `kos` | PostgreSQL | PostgreSQL |
| `dual` | JSON + PG (secondary best-effort) | JSON |

## Import

```powershell
pnpm kos:import-cases
```

Scans `case-library/**/*.case.json` into `app.case_record`.

## Hard constraint

Case KOS is operational only — **does not participate in Decision**; review pipeline unchanged.

## Next

**Epic E7** — Audit Log query API
