# Benchmark Dataset

Sprint 1.5 Epic 3 evaluation manifest for the AAIRP demo pipeline.

| `gray-copy-fixture.json` | Open Risk gray-copy semantic probe (32 cases: 8×CN/SG/MY/TH). Capability = LLM risk_type hit, not final_decision alone. |

## Gray-copy Open Risk eval

Deliberately avoids Rule/Playbook keywords. Score by **module attribution**:

```powershell
pnpm eval:gray-copy
pnpm eval:gray-copy -- --countries=CN
pnpm eval:gray-copy -- --countries=CN --copyIds=3,4,8
```

Reports: `reports/eval-gray-copy-*.json|.md`. Incidental disclosure/CPSR/COE hits are labeled and do **not** count as Open Risk capability.

## Files

| File | Purpose |
|------|---------|
| `ad-manifest.json` | Ground-truth benchmark cases (schema v1.0.0) |
| `benchmark-v2.json` | **Generated** Skill-linked benchmark (schema v2.0.0) |
| `benchmark-v2.overrides.json` | Per-case exceptions for v2 generation |

Legacy Epic 2 subset: `demo/quality-scenarios.json` (superseded by this manifest).

## Benchmark V2 (Sprint 3)

Golden dataset (`scripts/golden-benchmark-v1-cases.json`) is the source of truth.
Regenerate v2 after golden or taxonomy changes:

```powershell
pnpm knowledge:build-benchmark-v2
```

Do **not** hand-edit `benchmark-v2.json`.

## Schema

```json
{
  "schema_version": "1.0.0",
  "benchmark_id": "aairp-demo-benchmark",
  "regression_subset": ["case-id", "..."],
  "cases": [
    {
      "case_id": "unique-id",
      "description": "human readable",
      "tags": ["SG", "health.supplement", "REJECT"],
      "context": { "...": "ReviewContext for pipeline eval" },
      "ground_truth": {
        "expected_decision": "PASS|WARN|REJECT",
        "expected_findings": [{ "module": "RULE", "ref_id": "..." }],
        "must_not_include_refs": ["..."],
        "open_risk_skipped": true
      }
    }
  ]
}
```

Each case must have a unique `case_id` and labeled `ground_truth`.

## Run evaluation

From repo root (requires Node + pnpm):

```powershell
pnpm eval:benchmark              # full manifest → reports/
pnpm eval:benchmark -- --regression   # regression subset only
```

Output: `reports/eval-{timestamp}.{json,md,html}`

Metrics definitions: `docs/evaluation/metrics.md`
