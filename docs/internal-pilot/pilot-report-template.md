# Internal Pilot Report — AAIRP MVP Demo

**Pilot ID:** INTERNAL-PILOT-2026-06  
**Report date:** _______________  
**Prepared by:** _______________  
**Environment:** Node ___ / pnpm ___ / API live: Y / N

---

## 1. Executive summary

**Pilot decision:** ☐ GO  ☐ GO WITH RISK  ☐ NO-GO

One paragraph: L1 engine quality on SG health, L2 GAP findings, readiness for Sprint 2.

---

## 2. Scope executed

| Item | Planned | Executed | Notes |
|------|---------|----------|-------|
| Release gate (offline) | Yes | | |
| Release gate (live) | Yes | | |
| L1 benchmark regression (6 cases) | Yes | | |
| L2 manual cases (9) | Yes | | |
| Reviewer feedback forms | 2–3 | | |
| Real SG health samples (optional) | 0–15 | | |

---

## 3. L1 results — SG health.supplement

**Source:** `pnpm eval:benchmark -- --regression`

| Metric | Target | Actual | Pass? |
|--------|--------|--------|-------|
| Decision accuracy | ≥ 85% | | |
| BLOCKER recall | 100% | | |
| False REJECT rate | ≤ 5% | | |
| False PASS on REJECT | 0% | | |

**Failed cases (if any):** _______________

**Live API:** `sg-health-reject-cure` → _______________

---

## 4. L2 results — Exploratory

**Source:** `pilot/pilot-ad-log.csv` + `pilot/results/l2-run.json`

| Pilot ID | Theme | Cases | Human | AI (typical) | Agreement |
|----------|-------|-------|-------|--------------|-----------|
| P-001 | Absolute claim | 3 | WARN | | |
| P-002 | Health claim unsubstantiated | 3 | WARN | | |
| P-003 | Comparative no baseline | 3 | WARN | | |

**Total L2 rows:** ___  
**DISAGREE_DECISION count:** ___ (expected high)  
**Top GAP themes for Sprint 2:**

1. _______________
2. _______________
3. _______________

---

## 5. Qualitative feedback

Summarize [trial-feedback-template.md](../trial-feedback-template.md) scores:

| Dimension | Avg (1–5) | Notes |
|-----------|-----------|-------|
| Decision accuracy | | |
| Report clarity | | |
| Finding usefulness | | |
| Performance | | |
| Overall readiness | | |

---

## 6. Known limitations confirmed

- [ ] Stub LLM only
- [ ] Rules: SG + health.supplement only in engine
- [ ] In-memory storage
- [ ] No UI / no auth
- [ ] 30/32 dataset cases `manual` intent ≠ engine

---

## 7. Sprint 2 recommendations (priority order)

1. _______________
2. _______________
3. _______________

**Suggested first Epic:** ☐ Persistence  ☐ Real LLM  ☐ Rule pack (新马泰小家电)  ☐ Other: ___

---

## 8. Sign-off

| Role | Name | Date | Agrees with decision? |
|------|------|------|------------------------|
| PO | | | |
| Compliance | | | |
| AI Eval Lead | | | |
| Tech Lead | | | |

---

## Appendix

- `pilot/pilot-ad-log.csv`
- `pilot/results/` run artifacts
- `benchmark/reports/` (if generated)
- `docs/release-checklist.md`
