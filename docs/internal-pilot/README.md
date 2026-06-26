# Internal Pilot — Closeout Pack

Sprint 1.5 MVP Demo internal validation before Sprint 2.

| Document | Purpose |
|----------|---------|
| [checklist.md](./checklist.md) | Day-by-day closeout tasks |
| [success-criteria.md](./success-criteria.md) | L1 hard metrics + go/no-go |
| [pilot-report-template.md](./pilot-report-template.md) | Final report to sign off |

## Data & scripts

| Path | Purpose |
|------|---------|
| `pilot/l1-manifest.json` | L1 case list (6 SG health benchmark cases) |
| `pilot/index.json` | L2 case list (9 新马泰小家电) |
| `pilot/pilot-ad-log.csv` | Human + AI decision log |
| `scripts/pilot-closeout.ps1` | Run L1 + L2 batch, write `pilot/results/` |
| `scripts/pilot-review.ps1` | Single or all L2 cases via API |

## Quick start (5 days)

```
Day 0  Install Node/pnpm → release-gate -SkipLive
Day 1  Start API → release-gate (full) → L1 metrics
Day 2  pilot-review -All → fill pilot-ad-log.csv
Day 3  Reviewers submit trial-feedback-template
Day 4  Write pilot report from template
Day 5  Sign-off → Sprint 2 planning
```

## Tracks

- **L1:** SG `health.supplement` — engine must hit metrics ([success-criteria.md](./success-criteria.md)).
- **L2:** 新马泰小家电 + other manual dataset — document GAP; does not block GO if L1 passes.

## Disclaimer

Demo samples are not legal advice. Stub LLM and limited rules are documented in [known-issues.md](../known-issues.md).
