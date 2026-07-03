# Knowledge Pack

Immutable **release metadata** for the five Knowledge Corpora — not runtime configuration, execution logic, or a knowledge duplication layer.

**Plan:** [SPRINT-5E-PLAN.md](../sprint-5/SPRINT-5E-PLAN.md)

## Lifecycle

```
Git corpora → corpus manifests → Knowledge Pack (draft) → validated → released
```

| Status | Mutable | Purpose |
|--------|---------|---------|
| `draft` | Yes | Working assembly |
| `validated` | Yes | Passed T0/T1 gates |
| `released` | **No** | Immutable release record |
| `deprecated` | No | Historical; superseded by newer pack |

## What a pack contains

| Included | Excluded |
|----------|----------|
| Corpus manifest fingerprints | Corpus entry JSON |
| Entry counts, KQS, validation summary | Benchmark case fixtures |
| Frozen dependency graph snapshot | Evidence documents |
| Evaluation linkage metadata | Runtime rule/playbook payloads |
| Compatibility matrix | case-library counts |

## Pack ID vs fingerprint

- **`knowledge_pack_id`** — human-facing monotonic ID, e.g. `kp-2026.07.1`
- **`knowledge_pack_fingerprint`** — SHA-256 integrity hash over canonical pack body

## Commands

```bash
pnpm knowledge:assemble-knowledge-pack
pnpm knowledge:validate-knowledge-pack
pnpm knowledge:release-knowledge-pack    # manual — sets AAIRP_PACK_RELEASED_BY
pnpm knowledge:pack-manifest             # assemble + validate draft (legacy alias)
pnpm knowledge:knowledge-pack-dashboard
```

## Release gates

| Tier | Blocks release |
|------|:--------------:|
| T0 | Corpus validators; all corpora present |
| T1 | Pack dependency / fingerprint checks |
| T2 | Warn — benchmark coverage, regression baseline ref |
| T3 | Warn — governance maturity |

## Related

- [KNOWLEDGE-ROADMAP-v1.0.md](./KNOWLEDGE-ROADMAP-v1.0.md)
- [benchmark/knowledge-pack/schema/knowledge-pack.schema.json](../benchmark/knowledge-pack/schema/knowledge-pack.schema.json)
