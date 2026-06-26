# KOS API — `/kos/v1/*`

**Status:** E7 Audit / Sprint 2A KOS complete (2026-06-26)

Knowledge Operating System HTTP API. All routes use **Problem+JSON** (`application/problem+json`) on error and **snake_case** JSON on success.

## Route isolation

| Prefix | Purpose | Runtime impact |
|--------|---------|----------------|
| `/health`, `/ready` | Platform probes | Shared infra checks |
| `/demo/*` | Sprint 1 Happy Path & step endpoints | **In-memory / file demo engines** — unchanged |
| `/admin/cases*` | Case library (JSON store) | Sidecar; **deprecated** — use `/kos/v1/cases*` |
| `/kos/v1/*` | KOS operational API | **DB-backed**; does not alter review pipeline |

**Hard rule:** No KOS handler may import or call `ReviewPipelineService`, `DecisionEngineService`, or mutate demo in-memory stores.

## Implemented (E0-S3 / E0-S4)

### `GET /kos/v1/health`

Liveness for the KOS gateway (does not replace `/health` or `/ready`).

**Response 200**

```json
{
  "status": "ok",
  "service": "aairp-api-kos",
  "version": "0.1.0-sprint1.5",
  "api_prefix": "/kos/v1",
  "timestamp": "2026-06-26T12:00:00.000Z"
}
```

### `GET /kos/v1/search`

Cross-object keyword search (read-only; **no audit write**).

| Param | Required | Values |
|-------|----------|--------|
| `type` | No | `rule`, `case`, `all` (default `all`) |
| `q` | No | Keyword (max 500 chars) |
| `country_id` | No | Facet, e.g. `SG` |
| `category_id` | No | Facet, e.g. `health.supplement` |
| `limit` | No | Default 20, max 100 |
| `offset` | No | Default 0 |

**Example:** `GET /kos/v1/search?type=rule&q=cure&country_id=SG`

**Response 200**

```json
{
  "items": [
    {
      "object_type": "rule",
      "object_id": "uuid-rule-version",
      "title": "SG-HEALTH-CURE",
      "snippet": "Prohibits absolute cure claims",
      "meta": {
        "rule_id": "uuid",
        "rule_key": "SG-HEALTH-CURE",
        "status": "PUBLISHED",
        "source": "postgres"
      }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "type": "rule",
  "q": "cure",
  "country_id": "SG"
}
```

**Search backends**

| Object | Primary | Fallback |
|--------|---------|----------|
| Rule | PostgreSQL `ILIKE` on summary / rule_key / display_name + JSONB scope facets | — |
| Case | PostgreSQL `case_record.search_text` | JSON `case-library/` manifest + ad text |

### `POST /kos/v1/publish`

Publish a **DRAFT** version. Archives the sibling `PUBLISHED` version for the same parent.

**Request**

```json
{
  "object_type": "rule",
  "version_id": "uuid-rule-version"
}
```

Optional header: `X-Kos-Actor: legal@demo`

**Response 200** — `KosPublishedVersion` (snake_case)

### `POST /kos/v1/rollback`

Re-publish a historical **ARCHIVED** version. Archives the current `PUBLISHED` sibling.

Same request shape as publish. Audit action = `ROLLBACK`.

Errors: `404` not found · `409` invalid state (e.g. publish non-DRAFT)

### Demo import CLI (E0-S6)

```powershell
pnpm kos:import-demo
# or
.\scripts\kos-import-demo.ps1
```

Imports `demo/rules.demo.json`, `demo/playbook.demo.md`, `demo/open-risk.prompt.txt`, and **3 SG demo regulations** into KOS as **PUBLISHED** versions. Idempotent — safe to re-run. Does **not** change Happy Path runtime (engines still read hardcoded / file demo).

### Regulation API (E1)

See [evidence/e1-completion-report.md](./evidence/e1-completion-report.md). List/create regulations, version CRUD (DRAFT editable), per-version publish/rollback, export bundle JSON.

### Rule API (E2)

See [evidence/e2-completion-report.md](./evidence/e2-completion-report.md). Rule pack CRUD, rule versions, publish/rollback via `KosPublishService`, regulation links, export pack JSON.

### Playbook API (E3)

See [evidence/e3-completion-report.md](./evidence/e3-completion-report.md). Playbook pack CRUD, version lifecycle, pattern edit (DRAFT only), publish/rollback, markdown export.

### Prompt API (E4)

See [evidence/e4-completion-report.md](./evidence/e4-completion-report.md). Prompt pack/template CRUD, version lifecycle, content lint, publish/rollback, text export.

### Case API (E5)

See [evidence/e5-completion-report.md](./evidence/e5-completion-report.md). Case search/export, lifecycle confirm/archive/rollback, dual-write via `AAIRP_CASE_STORAGE`.

### Feedback API (E6)

See [evidence/e6-completion-report.md](./evidence/e6-completion-report.md). Feedback CRUD, pilot CSV import, ratings validation.

### Audit API (E7)

See [evidence/e7-completion-report.md](./evidence/e7-completion-report.md) and [audit-policy.md](./audit-policy.md). Read-only audit query + CSV export.

## Shared list query (E0-S3)

All future list endpoints should use:

| Param | Default | Max | Notes |
|-------|---------|-----|-------|
| `limit` | 20 | 100 | Positive integer |
| `offset` | 0 | — | Non-negative integer |
| `q` | — | 500 chars | Optional keyword search |

Helpers: `parseKosListQuery`, `assertOnlyKnownKosListQueryParams`, `toPaginatedResponseDto`.

**Paginated response shape**

```json
{
  "items": [],
  "total": 0,
  "limit": 20,
  "offset": 0,
  "q": "optional-echo"
}
```

## Planned routes (Epic E1–E7)

| Method | Path | Epic |
|--------|------|------|
| GET | `/kos/v1/search` | ✅ E0-S4 |
| POST | `/kos/v1/publish`, `/kos/v1/rollback` | ✅ E0-S5 |
| GET/POST | `/kos/v1/regulations` | ✅ E1 |
| GET/POST | `/kos/v1/rule-packs`, `/rules`, `/rules/:id/versions` | ✅ E2 |
| GET/POST | `/kos/v1/playbook-packs/*` | ✅ E3 |
| GET/POST | `/kos/v1/prompt-templates/*` | ✅ E4 |
| GET | `/kos/v1/cases`, `/cases/:id`, `/cases/export` | ✅ E5 |
| GET/POST | `/kos/v1/feedback` | ✅ E6 |
| GET | `/kos/v1/audit-events` | ✅ E7 |

Publish / rollback per-object routes (E2+): `POST .../versions/:id/publish` may alias unified engine.

## Sprint 2A CLI summary

```powershell
pnpm migrate
pnpm kos:import-demo
pnpm kos:import-cases
pnpm kos:import-pilot-log
```

## Smoke test

```powershell
.\scripts\kos-smoke.ps1
```

Requires API running (`pnpm --filter @aairp/api dev`) with `DATABASE_URL` / `REDIS_URL` set.
