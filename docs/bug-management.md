# AAIRP — Bug Management (Sprint 1.5 Epic 5)

## Severity (S0–S3)

| Level | Name | Definition | Example |
|-------|------|------------|---------|
| **S0** | Outage | Service unusable; data loss | API crash on all requests |
| **S1** | Major | Core flow broken; wrong REJECT/PASS | Blocker ad returns PASS |
| **S2** | Minor | Degraded UX; non-blocking error | Missing field in error JSON |
| **S3** | Chore | Docs/env/tooling; no runtime impact | README curl outdated |

## Priority (P0–P3)

| Level | Definition | SLA target |
|-------|------------|------------|
| **P0** | Fix before any pilot | Same day |
| **P1** | Fix in current sprint | This sprint |
| **P2** | Fix next sprint | Sprint 1.5 close / Sprint 2 |
| **P3** | Backlog | When capacity allows |

## Workflow

1. Log in [bug-backlog.md](./bug-backlog.md) with unique `BUG-n` ID
2. Link root cause and fix plan
3. Fix P0/P1 in sprint; defer P2/P3 with target
4. Close with verification note (test / eval / manual)

## GitHub Issues

Use template: `.github/ISSUE_TEMPLATE/bug_report.md` for new reports from pilot users.

---

See also: [technical-debt.md](./technical-debt.md) | [known-issues.md](./known-issues.md)
