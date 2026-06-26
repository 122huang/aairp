# E4 — Prompt KOS

**Status:** Complete (2026-06-26)

## Deliverables

| Story | Item |
|-------|------|
| E4-S1 | `PgPromptRepository` — pack/template/version CRUD, draft guard, published export |
| E4-S2 | `/kos/v1/prompt-packs*` + `/prompt-templates*` API + publish/rollback via `KosPublishService` |
| E4-S3 | `lintPromptContent` — empty / max-size validation; `content_metadata` on version DTO |

## API routes

| Method | Path |
|--------|------|
| GET/POST | `/kos/v1/prompt-packs` |
| GET | `/kos/v1/prompt-packs/:packId` |
| GET/POST | `/kos/v1/prompt-packs/:packId/templates` |
| POST | `/kos/v1/prompt-templates/lint` |
| GET | `/kos/v1/prompt-templates/:templateId` |
| GET/POST | `/kos/v1/prompt-templates/:templateId/versions` |
| GET/PATCH | `/kos/v1/prompt-templates/:templateId/versions/:versionId` |
| GET | `/kos/v1/prompt-templates/:templateId/versions/:versionId/content` |
| POST | `.../publish`, `.../rollback` |
| GET | `/kos/v1/prompt-templates/:templateId/export` (text attachment) |

## Lint

- `EMPTY_CONTENT` — whitespace-only body rejected on create/update
- `CONTENT_TOO_LARGE` — max 256 KiB (aligned with API body limit)
- `POST /prompt-templates/lint` — dry-run without persisting

Version responses include `content_metadata`: `content_length`, `line_count`, `byte_length`.

## Hard constraint

`OpenRiskDiscoveryService` unchanged — runtime still reads `demo/open-risk.prompt.txt`.

## Next

**Epic E6** — Feedback KOS API
