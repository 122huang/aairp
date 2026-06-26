# Evaluation Metrics (Sprint 1.5 Epic 3)

| Metric | Definition |
|--------|------------|
| **Decision Accuracy** | Cases where `actual.final_decision === expected_decision` / total cases |
| **BLOCKER Recall** | Expected REJECT cases that received REJECT / all expected REJECT cases |
| **False REJECT Rate** | Cases expected PASS or WARN that received REJECT / non-REJECT expected cases |
| **Finding Precision** | Expected finding keys matched in actual / all actual finding keys in benchmark scope |
| **Finding Recall** | Expected finding keys matched in actual / all expected finding keys |
| **Finding F1** | Harmonic mean of finding precision and recall |

Finding key format: `{MODULE}:{ref_id}` (e.g. `RULE:demo-sg-health-forbidden-claim`).

## Reports

Each `pnpm eval:benchmark` run produces:

- **JSON** — machine-readable full result (`case_results`, `metrics`, `failed_case_ids`)
- **Markdown** — Accuracy Report summary table + case matrix
- **HTML** — same content for browser viewing
- **Explainability section** — per failed case: expected vs actual decision, findings diff, rationale

## Regression in CI

`pnpm test` includes `benchmark-regression.spec.ts` (runs regression subset, no file output).

Full benchmark eval runs via `pnpm eval:benchmark` (local or CI).
