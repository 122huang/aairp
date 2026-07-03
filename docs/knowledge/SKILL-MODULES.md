# Skill Modules (Executable Contracts)

**Version:** skill-modules-1.0.0  
**Status:** Canonical (Sprint 4A)  
**Machine-readable:** [skill-modules.json](./skill-modules.json)  
**ADR:** [ADR-004](../adr/ADR-004-executable-knowledge-system.md)

---

## Purpose

Skill Module Contracts (SMC) define **operational and evaluation metadata** for each review capability. They do **not** change runtime pipeline behavior in Sprint 4.

**Source of truth path:** `docs/knowledge/skill-modules.json`  
**Long-term:** KOS publish → Knowledge Pack → runtime/eval artifacts

The legacy [skill-taxonomy.json](./skill-taxonomy.json) is deprecated.

---

## Skill Modules

| Module | Owner type | Patterns |
|--------|------------|----------|
| Claim Review | legal | 7 |
| Evidence Review | legal | 1 |
| Localization Review | compliance | 1 |
| Consistency Review | compliance | 0 |
| Brand/IP Review | legal | 0 |
| Content Quality Review | knowledge_eng | 2 |
| AI Content Review | compliance | 0 |
| Disclaimer Review | legal | 2 |

Each module includes: `activation_conditions`, `applicable_rules`, `benchmark_scope`, `rewrite_strategy`, `escalation_policy`, and ownership metadata.

---

## Benchmark lifecycle

```
Case Library → Human Verified → Promotion Queue → benchmark-v3 (candidate) → Regression tier
```

See `benchmark/benchmark-promotion-queue.json`.

---

## Commands

```bash
pnpm knowledge:build-benchmark-v3
pnpm eval:benchmark-v3
pnpm knowledge:health-report
pnpm knowledge:pack-manifest
```
