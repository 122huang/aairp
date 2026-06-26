# Case Library

**Architecture:** [CASE-LIBRARY-ARCHITECTURE.md](./CASE-LIBRARY-ARCHITECTURE.md)

**Review strategy (target):** [CASE-FIRST-REVIEW-STRATEGY.md](./CASE-FIRST-REVIEW-STRATEGY.md) — Rule → Case → Playbook → LLM → Decision

**Implementation (Case Auto Save):** enabled by default on `POST /demo/review`. Env: `AAIRP_CASE_LIBRARY_ENABLED`, `AAIRP_CASE_LIBRARY_PATH` (default `case-library/`).

| API | Purpose |
|-----|---------|
| `GET /admin/cases` | Search (country, category, platform, decision, …) |
| `GET /admin/cases/:caseId` | Full case JSON |
| `GET /admin/cases/export` | Export all cases as JSON bundle |


| Phase | Storage |
|-------|---------|
| 1 | JSON (`case-library/`) |
| 2 | PostgreSQL |
| 3 | Vector index |
