# Sprint 4 — Executable Knowledge System

**Status:** 4A complete  
**ADR:** [ADR-004](../adr/ADR-004-executable-knowledge-system.md)  
**Plan:** [SPRINT-4A-PLAN.md](./SPRINT-4A-PLAN.md)

## Theme

Transform the Knowledge System from a **static repository** into an **Executable Knowledge System**:

- Skill Modules = operational/evaluation contracts (not a runtime engine)
- Benchmark V3 = quality specification with lifecycle
- Knowledge Health = accountability + freshness + effectiveness
- Knowledge Pack = immutable release unit

## Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **4A** | Schema, benchmark-v3 gen, eval framework, health report | Complete |
| **4A.1** | Regression calibration + failure analysis | Complete |
| **4B** | Module dashboard, health KPIs, KOS ownership | In progress |
| **4C** | CI knowledge gate, promotion automation | Planned |
| **4D** | KOS → Pack export convergence | Planned |

## Frozen

- Runtime pipeline: `Rule → Playbook → LLM → Decision`
- No Skill Engine, Pattern Library, knowledge graph, or rule expansion

## Commands (Sprint 4B)

```bash
pnpm eval:module-dashboard -- --tier=regression
pnpm eval:benchmark-v3 -- --tier=regression
pnpm knowledge:health-report
pnpm knowledge:validate-linkage
pnpm knowledge:pack-manifest
```

## Baseline

See [BENCHMARK-V3-BASELINE.md](./BENCHMARK-V3-BASELINE.md) — regression tier frozen at **97.8%** weighted quality, **100%** decision accuracy, **9 cases**.

## Commands (Sprint 4A)

```bash
pnpm knowledge:build-benchmark-v3
pnpm eval:benchmark-v3
pnpm eval:benchmark-v3 -- --tier=regression --no-write
pnpm knowledge:health-report
pnpm knowledge:validate-linkage
pnpm knowledge:pack-manifest
```

## Prerequisites (Sprint 3)

```bash
pnpm knowledge:build-benchmark-v2
pnpm knowledge:validate-linkage
pnpm knowledge:pack-manifest
```
