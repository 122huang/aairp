# Epic 1 — System Stabilization — Completion Report

**Date:** 2026-06-26  
**Mode:** Review → Fix → Test → PASS  
**Epic Status:** **PASS (code)** / **Test gate OPEN (host env)**

---

## Story Summary

| Story | Title | Code Review | Tests | Status |
|-------|-------|-------------|-------|--------|
| E1-S1 | 环境与启动稳定 | PASS | Not run (no Node) | **PASS*** |
| E1-S2 | 共享请求校验 | PASS | Not run | **PASS*** |
| E1-S3 | Pipeline 耗时日志 | PASS | Not run | **PASS*** |
| E1-S4 | LLM 超时/重试 | PASS | Not run | **PASS*** |
| E1-S5 | Pipeline 编排去重 | PASS | Not run | **PASS*** |

\* Code-complete; automated test execution blocked on host (Node/pnpm not in PATH). CI workflow added for remote verification.

---

## E1-S1 — 环境与启动稳定

### Code Review (PASS)
- `.env.example` matches `loadApiConfig()` requirements
- `docker-compose.yml`: PG 16 + Redis 7 with healthchecks
- `scripts/start-deps.ps1`, `scripts/start-dev.ps1`, `scripts/smoke-test.ps1`
- `.github/workflows/ci.yml` for build/test gate
- README Sprint 1.5 quick start

### Fixes Applied
- `start-deps.ps1`: handle docker compose JSON array vs single object

### Tests
| Type | Result |
|------|--------|
| Unit | BLOCKED — `node` not found |
| Integration | BLOCKED |
| Smoke | BLOCKED — `scripts/smoke-test.ps1` requires pnpm |

### Technical Debt
- Local Node/pnpm install required for T11 + smoke (TD-5)

### Next Story
✅ Proceed to E1-S2 (completed)

---

## E1-S2 — 共享请求校验

### Code Review (PASS)
- `parseJsonObjectBody` / `parseAdvertisementIdRequest` in `apps/api/src/validation/demo-request.ts`
- All `/demo/*` id-based controllers use shared parser
- `AppError.toProblemDetails()` maps `extras.errors` to RFC7807 `errors` array
- Domain upload limits unchanged (`UPLOAD_LIMITS` in domain layer)

### Fixes Applied
- Controller specs aligned with shared validation (prior session + this session)

### Tests
- `demo-request.spec.ts` — static review OK; runtime BLOCKED

### Technical Debt
- None for this story

---

## E1-S3 — Pipeline 耗时日志

### Code Review (PASS)
- `ReviewPipelineService` measures per-stage ms
- `logReviewPipelineTimings()` used in `demo-review`, `decision`, `open-risk`, `review-report` controllers
- Structured fields: `duration_ms`, `stage_ms.{rule,playbook,open_risk,decision,report}`

### Tests
- `review-pipeline.service.spec.ts` asserts timings ≥ 0 — BLOCKED at runtime

---

## E1-S4 — LLM 超时/重试

### Code Review (PASS)
- `createResilientLlmGateway` with timeout + retry
- `resolveOpenRiskGatewayConfig()` reads `OPEN_RISK_TIMEOUT_MS`, `OPEN_RISK_MAX_RETRIES`
- `OpenRiskDiscoveryService` wraps default Stub gateway
- `LlmGatewayTimeoutError` surfaced on timeout

### Minor (not fixed — out of scope)
- Timeout failure returns generic 500, not 503 (acceptable for demo MVP)

### Tests
- `llm-gateway.utils.spec.ts` — BLOCKED at runtime

---

## E1-S5 — Pipeline 编排去重

### Code Review (PASS)
- `ReviewPipelineService`: `runThroughOpenRisk`, `runThroughDecision`, `runThroughReport`
- `buildPriorFindingsSummary` in shared-kernel
- Controllers delegate to pipeline; `ReviewHappyPathService` uses `runThroughReport`
- `app.ts` wires single pipeline instance

### Fixes Applied (this session)
- `decision.controller.spec.ts` rewritten for `ReviewPipelineService`
- `open-risk-discovery.controller.spec.ts`, `review-report.controller.spec.ts`, `demo-review.controller.spec.ts` updated by parallel agent

### Tests
- Controller integration tests use real `ReviewPipelineService` — BLOCKED at runtime

---

## Modifications (Epic 1 aggregate)

| Area | Files |
|------|-------|
| Env / ops | `.env.example`, `docker-compose.yml`, `scripts/*.ps1`, `.github/workflows/ci.yml` |
| Validation | `apps/api/src/validation/demo-request.ts`, controller imports |
| Logging | `apps/api/src/middleware/review-logging.ts`, controller call sites |
| Resilience | `packages/application/src/review/llm-gateway.utils.ts`, `open-risk-discovery.service.ts` |
| Pipeline | `review-pipeline.service.ts`, `review-pipeline.ts`, `review-happy-path.service.ts`, `app.ts` |
| Tests | All affected `*.spec.ts` files |
| Docs | `README.md`, `docs/sprint-1.5/evidence/epic-1-test-log.md`, `docs/technical-debt.md` |

---

## Test Execution

```text
Command: pnpm test
Result:  NOT EXECUTED — Node.js and pnpm not available in agent shell PATH
Action:  Install Node >= 20 + pnpm, then run:
         pnpm install && pnpm build && pnpm test
         .\scripts\smoke-test.ps1
         Or push to GitHub and verify CI workflow
```

---

## Remaining Technical Debt

See `docs/technical-debt.md` (TD-1 through TD-5).

---

## Recommendation

| Question | Answer |
|----------|--------|
| Epic 1 code ready? | **Yes** |
| Epic 1 fully verified? | **No** — run tests locally or via CI |
| Proceed to Epic 2? | **Yes**, after `pnpm test` green (or CI green). No PRD/architecture blockers. |

Epic 2 scope (per Sprint 1.5 plan): **Review Quality & Benchmark Validation** — no new business features.
