# E2 — Rule KOS

**Status:** Complete (2026-06-26)

## Deliverables

| Story | Item |
|-------|------|
| E2-S1 | `PgRuleRepository` — updateVersion, regulation links, exportPack; publish via `KosPublishService` |
| E2-S2 | `/kos/v1/rule-packs*` + `/rules*` CRUD, publish/rollback, audit |
| E2-S3 | Search filters `status`/`severity`; pack export JSON; regulation links |

## API routes

| Method | Path |
|--------|------|
| GET/POST | `/kos/v1/rule-packs` |
| GET | `/kos/v1/rule-packs/:packId` |
| GET/POST | `/kos/v1/rule-packs/:packId/rules` |
| GET | `/kos/v1/rule-packs/:packId/export` |
| GET | `/kos/v1/rules/:ruleId` |
| GET/POST | `/kos/v1/rules/:ruleId/versions` |
| GET/PATCH | `/kos/v1/rules/:ruleId/versions/:versionId` |
| PUT | `/kos/v1/rules/:ruleId/versions/:versionId/regulation-links` |
| POST | `.../publish`, `.../rollback` |

Search: `GET /kos/v1/search?type=rule&q=cure&country_id=SG&status=PUBLISHED&severity=BLOCKER`

## Export format

`GET /rule-packs/demo-rules/export` → JSON aligned with `demo/rules.demo.json` (published versions + regulation links).

## Hard constraint

`RuleEngineService` unchanged — KOS rules are operational; runtime still uses hardcoded demo.

## Next

**Epic E4** — Prompt KOS API
