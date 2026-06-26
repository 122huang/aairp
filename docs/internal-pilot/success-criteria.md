# Internal Pilot — Success Criteria

**Scope:** MVP Demo (`POST /demo/review`), Stub LLM, SG health rules only in engine.  
**Audience:** PO, Compliance, AI Evaluation Lead, Tech Lead.

---

## Tracks

| Track | Scope | Purpose |
|-------|--------|---------|
| **L1** | SG + `health.supplement` | Hard metrics — engine must meet bar |
| **L2** | Other countries/categories + manual real ads | Exploratory — quantify GAP vs human |

---

## L1 — Hard metrics (must pass for **GO**)

Source: `pnpm eval:benchmark -- --regression` (6 cases in `benchmark/ad-manifest.json`).

| Metric | Target | Notes |
|--------|--------|-------|
| Decision accuracy | **≥ 85%** | vs benchmark `expected_decision` |
| BLOCKER recall | **100%** | `sg-health-reject-cure` must REJECT |
| False REJECT rate | **≤ 5%** | PASS cases must not REJECT |
| False PASS on REJECT | **0%** | REJECT case must never PASS |

Live API sanity (release gate live):

- `POST /demo/review` + `sg-health-reject-cure` → **REJECT**
- `/health` and `/ready` OK when deps up

---

## L2 — Exploratory (does not block GO; documents Sprint 2 backlog)

Source: `pilot/` manual cases (9 × 新马泰小家电) + optional dataset `manual` cases.

| Metric | Target | Notes |
|--------|--------|-------|
| Human review completed | **100%** of L2 cases in log | Fill `pilot/pilot-ad-log.csv` |
| GAP catalogued | Every `DISAGREE_DECISION` has `issue_type` + `severity` | Expected for current engine |
| Report usability | ≥ 3/5 avg from reviewers | `docs/trial-feedback-template.md` |

**Expected today:** L2 cases with human **WARN** and engine **PASS** → `DISAGREE_DECISION` / `GAP`. This is **by design**, not a pilot failure.

---

## Pilot closeout decision

| Outcome | L1 | L2 | Sprint 2 |
|---------|----|----|----------|
| **GO** | All L1 targets met | GAPs documented | Start Sprint 2 per backlog |
| **GO WITH RISK** | L1 met; live gate skipped or minor doc gap | GAPs documented | Sprint 2 with explicit rule-pack Epic |
| **NO-GO** | BLOCKER miss or false PASS on REJECT | — | Fix engine before Sprint 2 |

---

## Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| PO | | | |
| Compliance | | | |
| Tech Lead | | | |
