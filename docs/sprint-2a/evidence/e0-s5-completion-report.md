# E0-S5 — Publish / rollback engine

**Status:** Complete (2026-06-26)

## Deliverables

| Item | Path |
|------|------|
| Publish port | `packages/shared-kernel/src/knowledge/publish.ts` |
| PG engine | `packages/infrastructure/src/knowledge/pg-kos-publish.repository.ts` |
| Application service | `packages/application/src/knowledge/kos-publish.service.ts` |
| Transaction support | `PgDatabaseClient.withTransaction` |
| API | `POST /kos/v1/publish`, `POST /kos/v1/rollback` |
| Integration test | `pg-kos-publish.repository.integration.spec.ts` |

## Behaviour

| Operation | Rule state required | Side effects |
|-----------|---------------------|--------------|
| **publish** | Target = `DRAFT` | Archive sibling `PUBLISHED` → `ARCHIVED`; target → `PUBLISHED`; audit `PUBLISH` |
| **rollback** | Target = `ARCHIVED` | Archive current `PUBLISHED`; target → `PUBLISHED`; audit `ROLLBACK` |

All steps run in a **single PostgreSQL transaction** (version updates + audit insert).

Supported `object_type`: `rule`, `regulation`, `playbook`, `prompt`.

## DoD checklist

- [x] `KosPublishService.publish(objectType, versionId)`
- [x] `KosPublishService.rollback(objectType, versionId)`
- [x] Same transaction: archive old PUBLISHED + audit
- [x] Rule publish + rollback PG integration test (CI `migrate-smoke`)
- [x] Rollback audit action = `ROLLBACK`
- [x] Happy Path untouched

## Next

**E0-S6** — `pnpm kos:import-demo` demo knowledge import
