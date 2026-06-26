# Epic 3 — Evaluation Framework — Completion Report

**Date:** 2026-06-26  
**Epic Status:** **PASS (code)** / **Test gate OPEN (host env)**

---

## Story Summary

| Story | Title | Code Review | Tests | Status |
|-------|-------|-------------|-------|--------|
| E3-S1 | Benchmark + Ground Truth | PASS | BLOCKED | **PASS*** |
| E3-S2 | Evaluation Runner | PASS | BLOCKED | **PASS*** |
| E3-S3 | Metrics & Reports | PASS | BLOCKED | **PASS*** |
| E3-S4 | Regression Test 集成 | PASS | BLOCKED | **PASS*** |

---

## E3-S1 — Benchmark 数据结构与 Ground Truth

**Deliverables:**
- `benchmark/ad-manifest.json` — schema v1.0.0, 6 labeled cases, `regression_subset`
- `benchmark/README.md` — schema documentation
- Supersedes Epic 2 `demo/quality-scenarios.json`

**Ground truth fields:** `expected_decision`, `expected_findings[]`, `must_not_include_refs`, `open_risk_skipped`

---

## E3-S2 — Evaluation Runner

**Deliverables:**
- `packages/application/src/evaluation/benchmark-evaluator.service.ts`
- `packages/application/src/evaluation/run-benchmark.ts` — CLI entry
- Root script: `pnpm eval:benchmark`
- `scripts/eval-benchmark.ps1`

**Behavior:** Direct `ReviewPipelineService` eval (no API required); writes JSON/MD/HTML to `reports/`

**Usage:**
```powershell
pnpm eval:benchmark
pnpm eval:benchmark -- --regression
```

---

## E3-S3 — Metrics & Reports

**Metrics:** Decision Accuracy, BLOCKER Recall, False REJECT Rate, Finding Precision/Recall/F1

**Deliverables:**
- `eval-metrics.ts`, `eval-report.ts`
- `docs/evaluation/metrics.md`
- Output: `reports/eval-{timestamp}.{json,md,html}` with Explainability section for failures

---

## E3-S4 — Regression Test 集成

**Deliverables:**
- `benchmark-regression.spec.ts` — runs regression subset in vitest (included in `pnpm test`)
- CI: `.github/workflows/ci.yml` runs `pnpm eval:benchmark -- --regression` after tests
- Removed duplicate `review-quality.spec.ts` (merged into benchmark framework)

---

## Test Execution

| Command | Result |
|---------|--------|
| `pnpm test` (includes benchmark-regression) | BLOCKED — no Node/pnpm |
| `pnpm eval:benchmark` | BLOCKED |

---

## Remaining Technical Debt

| Item | Target |
|------|--------|
| 32+ country dataset (Epic 4) | Expand manifest beyond 6 SG health cases |
| Weekly full benchmark | Document in ops; CI runs regression subset only |
| Upload-based eval cases | Optional: add `upload` field for happy-path service eval |

---

## Recommendation

Proceed to **Epic 4 — Demo Advertisement Dataset** (8 countries × 4 categories).
