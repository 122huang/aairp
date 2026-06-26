# E1 — Regulation KOS

**Status:** Complete (2026-06-26)

## Deliverables

| Story | Item |
|-------|------|
| E1-S1 | `PgRegulationRepository` + demo seed (3 SG regulations in `kos:import-demo`) |
| E1-S2 | `/kos/v1/regulations*` CRUD + publish/rollback + audit |
| E1-S3 | `GET /kos/v1/search?type=regulation` + export bundle + rule link |

## API routes

| Method | Path |
|--------|------|
| GET | `/kos/v1/regulations` |
| POST | `/kos/v1/regulations` |
| GET | `/kos/v1/regulations/:id` |
| GET | `/kos/v1/regulations/:id/versions` |
| POST | `/kos/v1/regulations/:id/versions` |
| GET | `/kos/v1/regulations/:id/versions/:versionId` |
| PATCH | `/kos/v1/regulations/:id/versions/:versionId` (DRAFT only) |
| POST | `/kos/v1/regulations/:id/versions/:versionId/publish` |
| POST | `/kos/v1/regulations/:id/versions/:versionId/rollback` |
| GET | `/kos/v1/regulations/:id/export` |

Search: `GET /kos/v1/search?type=regulation&q=Health+Products&jurisdiction=SG`

## Demo regulations (import)

| Key | Law |
|-----|-----|
| `sg-hpa-s7` | SG Health Products Act (Demo) — Section 7 |
| `sg-asasa-substantiation` | ASAS Code — Substantiation |
| `sg-scap-disclosure` | SCAP — Ad disclosure |

`demo-sg-health-forbidden-claim` rule links to `sg-hpa-s7` via `rule_version_regulation`.

## Hard constraint

Regulation KOS is **operational only** — `RuleEngineService` unchanged.

## Next

**Epic E2** — Rule KOS API (`/kos/v1/rule-packs`)
