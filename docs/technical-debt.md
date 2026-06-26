# AAIRP — Technical Debt Ledger (Sprint 1.5)

Last updated: 2026-06-26

| ID | Item | Root Cause | Fix Plan | Target | Status |
|----|------|------------|----------|--------|--------|
| TD-1 | Business data in memory | Happy Path demo scope | Advertisement/Review PG persistence | Sprint 2 | Open |
| TD-2 | Stub LLM only | MVP hardening without new provider | Real gateway behind env flag | Sprint 2+ | Open |
| TD-3 | `/demo/*` no auth | Demo endpoint convention | `/v1/reviews` + auth middleware | Sprint 2 | Open |
| TD-4 | Benchmark eval in CI | Epic 3 | `pnpm eval:benchmark --regression` in CI | Sprint 1.5 | **Done** |
| TD-5 | T11 live curl acceptance | Env blocker | `smoke-test-live.ps1` + `demo-review.ps1` | Sprint 1.5 close | Open |
| TD-6 | 30 manual-only dataset labels | Rules scoped to SG health | Country/category rule packs | Sprint 2+ | Open |
| TD-7 | Open Risk timeout → HTTP 500 | Generic error mapping | Map `LlmGatewayTimeoutError` → 503 | Sprint 2 | Open |
| TD-8 | Duplicate quality-scenarios.json | Epic 2 → Epic 3 migration | Remove after benchmark stable | Sprint 2 | Open |

---

When adding debt: assign ID, root cause, fix plan, target sprint. Review at sprint close.

See: [known-issues.md](./known-issues.md)
