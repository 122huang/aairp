# E3 — Playbook KOS

**Status:** Complete (2026-06-26)

## Deliverables

| Story | Item |
|-------|------|
| E3-S1 | `PgPlaybookRepository` — pack/version/pattern CRUD, draft guard, markdown export |
| E3-S2 | `/kos/v1/playbook-packs*` API + publish/rollback via `KosPublishService`, audit |
| E3-S3 | Markdown export aligned with `demo/playbook.demo.md` round-trip |

## API routes

| Method | Path |
|--------|------|
| GET/POST | `/kos/v1/playbook-packs` |
| GET | `/kos/v1/playbook-packs/:packId` |
| GET/POST | `/kos/v1/playbook-packs/:packId/versions` |
| GET | `/kos/v1/playbook-packs/:packId/versions/:versionId` |
| GET/POST | `/kos/v1/playbook-packs/:packId/versions/:versionId/patterns` |
| GET/PATCH | `/kos/v1/playbook-packs/:packId/versions/:versionId/patterns/:patternId` |
| POST | `.../publish`, `.../rollback` |
| GET | `/kos/v1/playbook-packs/:packId/export` (markdown attachment) |

## Export format

`GET /playbook-packs/:packId/export` → `text/markdown` attachment from published version patterns.

## Hard constraint

`PlaybookEngineService` unchanged — KOS playbooks are operational; runtime still reads `demo/playbook.demo.md`.

## Next

**Epic E5** — Case KOS unify
