# E0-S4 — Universal search

**Status:** Complete (2026-06-26)

## Deliverables

| Item | Path |
|------|------|
| Search port | `packages/shared-kernel/src/knowledge/search.ts` |
| PG repository | `packages/infrastructure/src/knowledge/pg-kos-search.repository.ts` |
| Search service | `packages/application/src/knowledge/kos-search.service.ts` |
| API | `GET /kos/v1/search` |
| Query validation | `apps/api/src/validation/kos-search-query.ts` |

## DoD checklist

- [x] Rule + Case searchable via unified endpoint
- [x] Facets: `type`, `q`, `country_id`, `category_id`, `limit`, `offset`
- [x] Rule search uses PG `ILIKE` + scope JSONB facets (GIN indexes from E0-S2)
- [x] Case search: PG first, JSON `case-library/` fallback
- [x] Read-only — no audit writes
- [x] Demo / Happy Path untouched
- [x] Unit tests (service + controller + query validation)

## Next

**E0-S5** — `KosPublishService` publish / rollback engine
