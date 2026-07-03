# Baseline Test Issues

Known test failures that **predate Sprint 5F** and are **out of scope** for knowledge visibility work. Documented here to prevent confusion when running the full `pnpm test` suite.

**Last verified:** 2026-07-01 (post–Sprint 5G acceptance)

---

## Summary

| # | Test | File | Status | Introduced before 5F | Owner / future sprint |
|---|------|------|--------|:--------------------:|----------------------|
| 1 | matches standalone cure term | `content-matching.spec.ts` | **Failing** | Yes | Review pipeline — Sprint 6 |
| 2 | uses hybrid vector strategy when embeddings are available | `case-retrieval.service.spec.ts` | **Failing** | Yes | Case retrieval — Sprint 6 |
| 3 | downgrades REJECT suggested_action to MANUAL_REVIEW | `open-risk-discovery.service.spec.ts` | **Failing** | Yes | Open Risk module — Sprint 6 |

**5F-specific tests:** `knowledge-preview.spec.ts`, `knowledge-visibility.spec.ts` — all passing.

**Benchmark regression (post–5F):** `pnpm eval:benchmark-v3 -- --tier=regression` — **9/9 passed**, 97.8% weighted quality, stable vs baseline. See [SPRINT-5F-PLAN.md](../sprint-5/SPRINT-5F-PLAN.md) acceptance criteria.

---

## Issue 1 — content-matching word boundary offset

| Field | Value |
|-------|-------|
| **Test name** | `matches standalone cure term` |
| **File** | `packages/application/src/review/content-matching.spec.ts` |
| **Module** | Rule engine / content matching |
| **Failure** | Expected match `start: 16`, received `start: 17` for term `cure` in `"This product can cure diabetes fast."` |
| **Introduced before 5F** | Yes — review pipeline; no 5F files touch `content-matching` |
| **Likely cause** | Test expectation out of sync with current word-boundary indexing (off-by-one) |
| **Owner** | Review pipeline maintainers |
| **Target sprint** | Sprint 6 (review pipeline hardening) |
| **5F action** | None — do not fix in 5F/5G knowledge sprints |

---

## Issue 2 — case-retrieval hybrid vector test setup

| Field | Value |
|-------|-------|
| **Test name** | `uses hybrid vector strategy when embeddings are available` |
| **File** | `packages/application/src/case/case-retrieval.service.spec.ts` |
| **Module** | Case retrieval / embeddings |
| **Failure** | `ReferenceError: embeddingProvider is not defined` at test construction |
| **Introduced before 5F** | Yes — case-first retrieval work; incomplete test fixture |
| **Likely cause** | Test references `embeddingProvider` without declaring or mocking it |
| **Owner** | Case library / retrieval |
| **Target sprint** | Sprint 6 (case-first completion) |
| **5F action** | None |

---

## Issue 3 — open-risk REJECT downgrade behavior

| Field | Value |
|-------|-------|
| **Test name** | `downgrades REJECT suggested_action to MANUAL_REVIEW` |
| **File** | `packages/application/src/review/open-risk-discovery.service.spec.ts` |
| **Module** | Open Risk discovery |
| **Failure** | Expected `findings[0].decision` to be `'REVIEW'`, received `undefined` |
| **Introduced before 5F** | Yes — Open Risk module; no 5F changes to `open-risk-discovery` |
| **Likely cause** | Service behavior or stub response shape changed; test not updated |
| **Owner** | Open Risk / LLM review module |
| **Target sprint** | Sprint 6 (review pipeline hardening) |
| **5F action** | None |

---

## What passes (reference)

These suites confirm **no runtime regression** from Sprint 5F:

```bash
# 5F knowledge tests
pnpm --filter @aairp/application test -- knowledge-preview knowledge-visibility

# Benchmark regression (Knowledge Pack stamped)
pnpm eval:benchmark-v3 -- --tier=regression

# Baseline comparison unit tests
pnpm --filter @aairp/application test -- benchmark-v3-baseline benchmark-regression
```

| Suite | Result (2026-07-01) |
|-------|---------------------|
| `knowledge-preview.spec.ts` | 3/3 pass |
| `knowledge-visibility.spec.ts` | 3/3 pass |
| `eval:benchmark-v3 --tier=regression` | 9/9 pass, 97.8% WQS |
| `benchmark-v3-baseline.spec.ts` | 2/2 pass (`regression_status: stable`) |
| `benchmark-regression.spec.ts` | 2/2 pass |
| Full `pnpm --filter @aairp/application test` | 271/274 pass (3 baseline issues above) |

---

## Policy

1. **Do not fix baseline issues inside Sprint 5F or 5G** unless explicitly scoped.
2. New knowledge-layer PRs should not increase the failure count.
3. When baseline issues are fixed, remove the row from this document and note the fix in the sprint that owns it.
