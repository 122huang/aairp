# Internal Pilot — Closeout Checklist

Use this list to **close** the Internal Pilot before Sprint 2 planning.  
Master script: `.\scripts\pilot-closeout.ps1`

---

## Phase 0 — Environment (Day 0)

- [ ] Node ≥ 20 + pnpm installed (`node --version`, `pnpm --version`)
- [ ] Repo: `cd aairp` → `pnpm install && pnpm build`
- [ ] Docker: `.\scripts\start-deps.ps1` (for `/ready` + live tests)
- [ ] API: `.\scripts\start-dev.ps1` (separate terminal)
- [ ] Read [known-issues.md](../known-issues.md) with reviewers

---

## Phase 1 — Release gate (Day 0–1)

- [ ] Offline: `.\scripts\release-gate.ps1 -SkipLive`  
  (build + test + benchmark regression + dataset auto)
- [ ] Live: `.\scripts\release-gate.ps1`  
  (includes live smoke: REJECT case + health/ready)
- [ ] Manual: [release-checklist.md](../release-checklist.md) items reviewed
- [ ] Open `report_html` from `sg-health-reject-cure` in browser

---

## Phase 2 — L1 evaluation (Day 1)

- [ ] Run benchmark regression (also inside release gate):
  ```powershell
  pnpm eval:benchmark -- --regression
  ```
- [ ] Record metrics in [pilot-report-template.md](./pilot-report-template.md):
  - Decision accuracy ___
  - BLOCKER recall ___
  - False REJECT rate ___
- [ ] Confirm `sg-health-reject-cure` → REJECT via API:
  ```powershell
  .\scripts\demo-review.ps1 -Case sg-health-reject-cure
  ```

**L1 pass?** See [success-criteria.md](./success-criteria.md).

---

## Phase 3 — L2 manual cases (Day 1–3)

- [ ] Run all 9 pilot cases:
  ```powershell
  .\scripts\pilot-review.ps1 -All -OutputJson pilot\results\l2-run.json
  ```
- [ ] Fill `ai_decision` + `reviewer` + `reviewed_at` in [pilot/pilot-ad-log.csv](../../pilot/pilot-ad-log.csv)
- [ ] Confirm expected GAP: human WARN vs engine PASS on P-001 / P-002 / P-003
- [ ] (Optional) Spot-check 5–10 dataset `manual` cases via `demo-review.ps1`

---

## Phase 4 — Reviewer feedback (Day 2–4)

- [ ] 2–3 reviewers complete [trial-feedback-template.md](../trial-feedback-template.md)
- [ ] File issues in [bug-backlog.md](../bug-backlog.md) if P0/P1 found

---

## Phase 5 — Pilot report & sign-off (Day 4–5)

- [ ] Copy [pilot-report-template.md](./pilot-report-template.md) → `docs/internal-pilot/pilot-report-YYYY-MM-DD.md`
- [ ] Fill L1 metrics, L2 GAP summary, Sprint 2 recommendations
- [ ] Decision: **GO** / **GO WITH RISK** / **NO-GO** ([success-criteria.md](./success-criteria.md))
- [ ] Sign-off table completed
- [ ] Share report with PO + Compliance + Tech Lead

---

## One-command closeout (after env ready)

```powershell
.\scripts\pilot-closeout.ps1              # offline L1 + optional live + L2 batch
.\scripts\pilot-closeout.ps1 -SkipLive    # no API required for L1 regression only
```

Results land in `pilot/results/`.
