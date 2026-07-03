# Legal Pilot Pack

English-facing internal pilot for Legal / Compliance stakeholders.

**中文法务内测版：** [内测说明.md](./内测说明.md) · [内测范围.md](./内测范围.md) · [内测清单.md](./内测清单.md) · 启动：`.\scripts\start-legal-pilot.ps1`

| Document | Purpose |
|----------|---------|
| [PILOT-SCOPE.md](./PILOT-SCOPE.md) | **One-page** in/out of scope for reviewers |
| [PILOT-CHECKLIST.md](./PILOT-CHECKLIST.md) | Reviewer walkthrough checklist |
| [../rc1-demo/DEMO-SCRIPT-3MIN.md](../rc1-demo/DEMO-SCRIPT-3MIN.md) | Live demo script (adapt narration to English UI) |
| [../internal-pilot/README.md](../internal-pilot/README.md) | Formal closeout after pilot week |

---

## Quick start

```powershell
cd C:\Users\ShujieHuang\aairp

# Dependencies: Postgres + Redis (docker compose up -d or local install)
$env:DATABASE_URL = "postgresql://aairp:aairp@localhost:5432/aairp"
$env:REDIS_URL    = "redis://localhost:6379"

pnpm install
pnpm build
pnpm migrate
pnpm seed:rc1-cases
pnpm dev:api
```

Open **http://localhost:3000/demo-ui/** — UI is English (Legal Pilot v1).

---

## 5 demo scenarios

| ID | Expected | Legal teaching point |
|----|----------|-------------------|
| `demo-01-reject-cure` | REJECT | Forbidden cure claim → Rule BLOCKER + citation; LLM skipped |
| `demo-02-pass-food` | PASS | Clean copy + #ad → no findings |
| `demo-03-warn-disclosure` | WARN | Missing #ad → regulation-driven disclosure rule |
| `demo-04-warn-superlative` | WARN | Superlatives → Rule + Playbook layers |
| `demo-05-pass-wellness` | PASS | Compliant supplement disclaimer + #ad |

---

## Pilot week (suggested)

| Day | Activity |
|-----|----------|
| 1 | Legal reads PILOT-SCOPE; ops starts API |
| 2 | Each reviewer runs 5 scenarios + checklist |
| 3 | Collect trial-feedback-template responses |
| 4 | Debrief: Rule/citation trust, gaps (images, markets) |
| 5 | pilot-report + go/no-go for Sprint 3 (auth, LLM, OCR) |

---

## What changed for Legal Pilot

- `apps/demo-ui/public/index.html` — English UI
- `apps/demo-ui/public/app.js` — English pipeline log & messages
- `apps/demo-ui/public/demo-cases.json` — English scenario labels

No review logic changes — UI and documentation only.
