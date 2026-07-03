# Knowledge

**Master roadmap:** [KNOWLEDGE-ROADMAP.md](./KNOWLEDGE-ROADMAP.md)

**Sprint 4:** [Executable Knowledge System](../sprint-4/README.md) · [ADR-004](../adr/ADR-004-executable-knowledge-system.md)  
**Sprint 5:** [Knowledge Corpus](../sprint-5/README.md) · [Regulation Corpus plan](../sprint-5/SPRINT-5A-PLAN.md)

**Skill Taxonomy:** [SKILL-TAXONOMY.md](./SKILL-TAXONOMY.md) · [skill-taxonomy.json](./skill-taxonomy.json)  
*(Sprint 4A will introduce `skill-modules.json` as the canonical contract export.)*

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
