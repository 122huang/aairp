# Benchmark Dataset

Sprint 1.5 Epic 3 evaluation manifest for the AAIRP demo pipeline.

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
