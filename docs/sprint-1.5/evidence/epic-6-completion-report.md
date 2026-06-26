# Epic 6 — Release Readiness — Completion Report

**Date:** 2026-06-26  
**Epic Status:** **PASS (code/docs)**

---

## Story Summary

| Story | Title | Status |
|-------|-------|--------|
| E6-S1 | Release & Deployment Checklist | **PASS** |
| E6-S2 | Smoke & Regression | **PASS** |
| E6-S3 | MVP 试用包 | **PASS** |

---

## E6-S1 — Checklists

| Document | Purpose |
|----------|---------|
| `docs/release-checklist.md` | Sign-off before pilot |
| `docs/deployment-checklist.md` | Step-by-step deploy |
| `docs/known-issues.md` | Pilot limitations (stub LLM, scope, etc.) |

---

## E6-S2 — Smoke & Regression

| Script | Scope |
|--------|-------|
| `scripts/smoke-test.ps1` | build + test + benchmark regression + dataset auto |
| `scripts/smoke-test-live.ps1` | `/health`, `/ready`, REJECT + PASS review |
| `scripts/release-gate.ps1` | Orchestrates offline (+ optional live) |
| CI | `.github/workflows/ci.yml` — test + benchmark regression |

---

## E6-S3 — MVP Trial Pack

| Item | Path |
|------|------|
| One-click demo | `scripts/demo-review.ps1 -Case {id}` |
| Feedback form | `docs/trial-feedback-template.md` |
| README pilot guide | MVP 试用指南 section |
| Dataset | 32 cases in `demo/dataset/` |

---

## Release gate (when env ready)

```powershell
.\scripts\start-deps.ps1
copy .env.example .env
.\scripts\release-gate.ps1          # full
.\scripts\release-gate.ps1 -SkipLive  # offline only
```

---

## Sprint 1.5 milestone

| Milestone | Status |
|-----------|--------|
| M1.5a Runnable | ✅ scripts + compose + CI |
| M1.5b Measurable | ✅ benchmark + dataset eval |
| M1.5c MVP Trial | ✅ checklists + pilot pack (pending live sign-off) |

**Sprint 1.5 engineering deliverables: COMPLETE.**  
Remaining: install Node/pnpm, run release gate, pilot feedback.
