# Sprint 4B — Module Dashboard & Health KPIs

**Status:** In progress  
**Prerequisites:** [Benchmark V3 Baseline](./BENCHMARK-V3-BASELINE.md) (frozen 2026-06-30)

## Priorities

| Priority | Deliverable | Status |
|----------|-------------|--------|
| **P0** | Skill Module Evaluation Dashboard | Done |
| **P0** | Per-module quality scoring | Done |
| **P0** | Benchmark regression reporting + T2 gate artifact | Done |
| **P1** | Knowledge Health Report enhancement | Done |
| **P2** | KOS ownership lifecycle metadata | Done |

## Commands

```bash
# P0 — module dashboard + T2 gate report (report-only)
pnpm eval:module-dashboard -- --tier=regression

# Regression eval (writes eval-v3-*.json)
pnpm eval:benchmark-v3 -- --tier=regression

# P1 — enhanced health report (skill quality, regression status, confidence)
pnpm knowledge:health-report

# P2 — KOS ownership lifecycle (requires migrate)
pnpm migrate
pnpm kos:import-demo
```

## Constraints (unchanged)

- No runtime pipeline changes
- No Skill Engine
- Knowledge Pack remains release unit
- T3 merge-block deferred
