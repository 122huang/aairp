# E0-S3 — KOS API gateway

**Status:** Complete (2026-06-26)

## Deliverables

| Item | Path |
|------|------|
| Fastify plugin | `apps/api/src/kos/register-kos-routes.ts` |
| KOS health | `GET /kos/v1/health` |
| Pagination helpers | `apps/api/src/validation/kos-pagination.ts` |
| Response DTO | `apps/api/src/dto/kos-pagination.dto.ts` |
| Route catalog | `docs/sprint-2a/kos-api.md` |
| Smoke script | `scripts/kos-smoke.ps1` |
| `NOT_FOUND` error code | `packages/shared-kernel/src/errors/problem-details.ts` |

## DoD checklist

- [x] `/kos/v1/health` → 200
- [x] Unified `limit` / `offset` / `q` validation
- [x] Problem+JSON reuse via existing error handler
- [x] Registered alongside `/demo/*` — no demo controller edits
- [x] Route isolation documented
- [x] Unit tests for health + pagination

## Next

**E0-S4** — `GET /kos/v1/search` (Rule + Case)
