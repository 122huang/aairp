# Benchmark V3 — Frozen Evaluation Baseline

**Baseline ID:** `benchmark-v3-baseline-2026-06-30`  
**Frozen:** 2026-06-30 (Sprint 4A.1 approval)  
**Artifact:** [`benchmark/benchmark-v3-baseline.json`](../../benchmark/benchmark-v3-baseline.json)  
**Eval snapshot:** [`benchmark/baseline/eval-v3-regression-baseline.json`](../../benchmark/baseline/eval-v3-regression-baseline.json)

---

## Trusted metrics (regression tier)

| Metric | Value |
|--------|------:|
| Weighted quality | **97.8%** |
| Decision accuracy | **100%** |
| Pattern hit rate | 100% |
| Blocker miss rate | 0% |
| False reject rate | 0% |
| Passed cases | 9 / 9 |
| Regression tier size | 9 cases |

## Module scores at freeze

| Skill Module | Cases | Quality | Decision Acc |
|--------------|------:|--------:|-------------:|
| Claim Review | 6 | 96.7% | 100% |
| Disclaimer Review | 2 | 100% | 100% |
| Content Quality Review | 1 | 100% | 100% |

## Known limitations

- Severity is scored but **not yet a pass/fail gate**
- Regression tier is **narrow** (9 cases) — expansion required before T3 merge-block
- **8/9** cases legally verified (`supplement-before-after-imagery` pending)
- Baseline reflects post-4A.1 evaluator/benchmark alignment, not production quality ceiling

## Gate policy

| Tier | Status |
|------|--------|
| **T2** report-only | Enabled — use `pnpm eval:module-dashboard` |
| **T3** merge-block | **Deferred** until tier ≥15 cases and 100% legal verification |

## Usage

Future eval runs compare against this baseline via:

```bash
pnpm eval:module-dashboard -- --tier=regression
pnpm knowledge:health-report
```

Do **not** edit frozen metrics in `benchmark-v3-baseline.json` without issuing a new baseline version.
