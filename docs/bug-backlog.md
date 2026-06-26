# AAIRP — Bug Backlog (Sprint 1.5)

Last updated: 2026-06-26

| ID | Severity | Priority | Summary | Root Cause | Fix Plan | Status |
|----|----------|----------|---------|------------|----------|--------|
| BUG-1 | S3 | P2 | T11 manual acceptance not executed | Host missing Node/pnpm/Docker | Run after env setup; use `demo-review.ps1` | Open |
| BUG-2 | S3 | P2 | `pnpm test` not verified on local host | Node/pnpm not in PATH | CI runs on push; local after install | Open |
| BUG-3 | S3 | P1 | README 验收 B 未含 `#ad` 却预期 PASS | Doc written before disclosure rule | **Fixed** — 验收 B 已加 `#ad` | **Closed** |
| BUG-4 | S3 | P2 | 30/32 dataset cases `intent` ≠ engine decision | No country/category rules yet | Epic 4 by design; pilot uses `intent` label | Accepted |
| BUG-5 | S2 | P3 | Stub LLM 与真实 LLM 行为差距 | MVP uses stub only | Document in known-issues; Sprint 2 provider | Open |

### Severity reference

S0 outage · S1 major · S2 minor · S3 chore

### Priority reference

P0 immediate · P1 this sprint · P2 next · P3 backlog

Process: [bug-management.md](./bug-management.md)
