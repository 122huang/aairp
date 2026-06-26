# E0-S6 — Demo knowledge import

**Status:** Complete (2026-06-26)

## Deliverables

| Item | Path |
|------|------|
| Import service | `packages/application/src/knowledge/kos-demo-import.service.ts` |
| Demo paths | `packages/application/src/knowledge/demo-knowledge-paths.ts` |
| CLI | `pnpm kos:import-demo` / `scripts/kos-import-demo.ps1` |
| Integration test | `kos-demo-import.integration.spec.ts` |

## Imported assets

| Demo file | KOS object | Pack key |
|-----------|------------|----------|
| `demo/rules.demo.json` | Rule (3 rules) | `demo-rules` |
| `demo/playbook.demo.md` | Playbook patterns | `demo-health-supplement-playbook` |
| `demo/open-risk.prompt.txt` | Prompt template | `demo-open-risk` / `open-risk-discovery` |

Flow: create DRAFT version → `KosPublishService.publish` → `PUBLISHED` + audit.

## Idempotency

Re-run skips when a matching **PUBLISHED** version already exists:
- **Rule:** same `demo_rule_version_id`, summary, severity, decision
- **Playbook:** same pattern `ref_id` set on published version
- **Prompt:** exact content match

## DoD checklist

- [x] `pnpm kos:import-demo` imports rules / playbook / prompt
- [x] Idempotent second run (CI)
- [x] Happy Path still uses hardcoded demo engines — **no runtime file changes**
- [x] Unit + integration tests

## Usage

```powershell
docker compose up -d postgres
.\scripts\migrate.ps1
.\scripts\kos-import-demo.ps1
```

## Epic E0

Platform scaffold complete: schema, migrate, `/kos/v1` gateway, search, publish/rollback, demo import.

**Next:** Epic E1 — Regulation CRUD API
