# Known Issues — MVP Pilot (Sprint 1.5)

**Audience:** Internal pilot users (compliance, product, BD)  
**Disclaimer:** Demo samples are **not legal advice**. Labels marked `manual` require human review.

---

## Environment

| Issue | Impact | Workaround |
|-------|--------|------------|
| Node ≥ 20 + pnpm required | Cannot build/test without install | Follow README quick start |
| PostgreSQL + Redis required for `/ready` | `/ready` returns 503 if deps down | `.\scripts\start-deps.ps1`; `/health` still works |
| Windows PATH may lack `node` | Scripts fail | Install Node; restart terminal |

## Functional (by design for MVP)

| Issue | Impact | Workaround |
|-------|--------|------------|
| **Stub LLM only** | Open Risk uses fixed stub JSON, not live model | Expect deterministic LLM findings; see TD-2 |
| **Rules: SG + health.supplement only** | Other countries/categories always PASS in engine | Use dataset `intent` for pilot feedback |
| **In-memory storage** | Ads/reviews lost on restart | Re-upload for each session |
| **No authentication** | Anyone with URL can call `/demo/*` | Internal network only; do not expose publicly |
| **Sync only** | Long reviews block HTTP | Keep demo ads short |

## Quality & eval

| Issue | Impact | Workaround |
|-------|--------|------------|
| Manual dataset cases (30/32) | `intent` may differ from `final_decision` | Record feedback in [trial-feedback-template.md](./trial-feedback-template.md) |
| Benchmark regression = SG health only | Full multi-country accuracy not measured | `pnpm eval:dataset` checks engine vs ground_truth |

## Fixed in Sprint 1.5

| Issue | Fix |
|-------|-----|
| `secure` false-triggering `cure` rule | Word-boundary matching (Epic 2) |
| Duplicate pipeline orchestration | `ReviewPipelineService` (Epic 1) |
| No benchmark/dataset eval | Epic 3 + Epic 4 |

---

Report new issues: [bug-backlog.md](./bug-backlog.md) or GitHub bug template.
