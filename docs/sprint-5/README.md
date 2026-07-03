# Sprint 5 — Knowledge Corpus

**Theme:** Build production-grade **Knowledge Corpora** as the long-term knowledge layer for AAIRP.  
**Master roadmap:** [KNOWLEDGE-ROADMAP-v1.0.md](../knowledge/KNOWLEDGE-ROADMAP-v1.0.md)  
**Constraint:** Knowledge Layer only — no runtime or review pipeline changes.

---

## Knowledge Corpus architecture

AAIRP knowledge is organized as multiple **corpus types** under a single **Knowledge Corpus** umbrella. Each corpus is versioned, indexed, and coverage-reportable. Runtime artifacts (rules, playbooks, benchmarks) remain downstream consumers — not authoring surfaces.

```
Knowledge Corpus
├── Regulation Corpus      ← Sprint 5A (first)
├── Internal Skill Corpus  ← planned
├── Evidence Corpus        ← planned (lab reports, certifications, test methods)
├── Case Corpus            ← planned (extends case-library governance)
└── Rewrite Corpus         ← planned (extends rewrite-templates)
```

| Corpus type | `corpus_type` | Sprint 5A status |
|-------------|---------------|------------------|
| Regulation | `regulation` | **In scope** |
| Internal Skill | `skill` | Reserved |
| Evidence | `evidence` | Reserved |
| Case | `case` | Reserved |
| Rewrite | `rewrite` | Reserved |

**Canonical identifier (long-term):** `knowledge_id` — stable across corpus types.  
Regulation entries in 5A also carry `regulation_id` (alias / type-specific key) for backward compatibility and clarity.

---

## Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **5A** | Regulation Corpus (first Knowledge Corpus) | Approved — **E1 complete** |
| **5B+** | Additional corpora, KOS import, cross-corpus linkage | Planned |

### Sprint 5A epic status

| Epic | Scope | Status |
|------|-------|--------|
| **E1** | Schema, taxonomy, loaders, authoring guide | **Done** |
| **E2** | ~70–80 regulation entries (frequency-prioritized) | **Done** (75 entries) |
| **E3** | Index generator + manifest | **Done** |
| **E4** | Coverage report + freshness | **Done** |
| **E5** | Validator + governance warnings | **Done** |
| **5B-E0** | Knowledge Platform Core (shared SDK) | **Done** |
| **5B-1** | Skill Corpus plugin (Advertising Review foundation) | **Done** |
| **5B-2** | Rewrite Corpus plugin | **Done** |
| **5C** | Evidence Corpus plugin (pilot 20+) | **Done** |
| **5D** | Case Corpus plugin (validation knowledge) | **Done** (28 pilot entries) |
| **5E** | Knowledge Pack / KOS foundation | **Done** — [KNOWLEDGE-PACK.md](../knowledge/KNOWLEDGE-PACK.md) |
| **5F** | Knowledge Visibility & Review Experience | **Closed** — [SPRINT-5F-PLAN.md](./SPRINT-5F-PLAN.md) |
| **5G** | Knowledge Evaluation & Feedback Loop | **Closed** — [SPRINT-5G-PLAN.md](./SPRINT-5G-PLAN.md) · [KNOWLEDGE-FEEDBACK-LOOP.md](../knowledge/KNOWLEDGE-FEEDBACK-LOOP.md) |

**Sprint 5 complete.** Knowledge Platform V1 foundation — see [V1-READINESS-REVIEW.md](../releases/V1-READINESS-REVIEW.md).  
**Next:** Version 1 Stabilization (Sprint 6) — hardening, integration, governance, pilot.
| E6 | Knowledge Pack corpus fingerprints (5B-4) | Absorbed into **5E** |

---

## Sprint 5A deliverables

- Regulation Corpus (~70–80 entries, 7 countries, 12 categories)
- Corpus index (`regulation-corpus.manifest.json`)
- Regulation coverage report
- Schema with generic `corpus_type`, `knowledge_id`, and reserved `related_evidence_ids`

**Plan:** [SPRINT-5A-PLAN.md](./SPRINT-5A-PLAN.md)

---

## Commands

```bash
pnpm knowledge:build-regulation-corpus-index
pnpm knowledge:regulation-coverage-report
pnpm knowledge:validate-regulation-corpus
pnpm knowledge:regulation-dashboard
pnpm knowledge:build-skill-corpus-index
pnpm knowledge:validate-skill-corpus
pnpm knowledge:skill-corpus-dashboard
pnpm knowledge:skill-corpus-drift-report
pnpm knowledge:build-rewrite-corpus-index
pnpm knowledge:validate-rewrite-corpus
pnpm knowledge:rewrite-corpus-dashboard
pnpm knowledge:rewrite-corpus-drift-report
pnpm knowledge:build-evidence-corpus-index
pnpm knowledge:validate-evidence-corpus
pnpm knowledge:evidence-corpus-dashboard
pnpm knowledge:evidence-corpus-drift-report
pnpm knowledge:platform-dashboard
pnpm knowledge:health-report
```

**Platform docs:** [SPRINT-5B-E0-KNOWLEDGE-PLATFORM-CORE.md](./SPRINT-5B-E0-KNOWLEDGE-PLATFORM-CORE.md)  
**Skill Corpus:** [SKILL-CORPUS.md](../knowledge/SKILL-CORPUS.md) · [SPRINT-5B-1-PLAN.md](./SPRINT-5B-1-PLAN.md)  
**Rewrite Corpus:** [REWRITE-CORPUS.md](../knowledge/REWRITE-CORPUS.md) · [SPRINT-5B-2-PLAN.md](./SPRINT-5B-2-PLAN.md)  
**Evidence Corpus:** [EVIDENCE-CORPUS.md](../knowledge/EVIDENCE-CORPUS.md) · [EVIDENCE-GOVERNANCE.md](../knowledge/EVIDENCE-GOVERNANCE.md) · [SPRINT-5C-PLAN.md](./SPRINT-5C-PLAN.md)  
**Case Corpus:** [CASE-CORPUS.md](../knowledge/CASE-CORPUS.md) · [SPRINT-5D-PLAN.md](./SPRINT-5D-PLAN.md)  
**Knowledge Pack:** [KNOWLEDGE-PACK.md](../knowledge/KNOWLEDGE-PACK.md) · [SPRINT-5E-PLAN.md](./SPRINT-5E-PLAN.md)  
**Knowledge Visibility:** [SPRINT-5F-PLAN.md](./SPRINT-5F-PLAN.md) · [KNOWLEDGE-VISIBILITY.md](../knowledge/KNOWLEDGE-VISIBILITY.md)  
**Knowledge Feedback Loop:** [SPRINT-5G-PLAN.md](./SPRINT-5G-PLAN.md) · [KNOWLEDGE-FEEDBACK-LOOP.md](../knowledge/KNOWLEDGE-FEEDBACK-LOOP.md)  
**Test baseline:** [BASELINE-ISSUES.md](../testing/BASELINE-ISSUES.md)  
**V1 readiness:** [V1-READINESS-REVIEW.md](../releases/V1-READINESS-REVIEW.md)  
**S6.2 integration:** [PRODUCT-INTEGRATION-S6.2.md](../architecture/PRODUCT-INTEGRATION-S6.2.md) · [PRD-KNOWLEDGE-COPILOT-V1.md](../product/PRD-KNOWLEDGE-COPILOT-V1.md)  
**ADRs:** [ARCHITECTURE-DECISION-RECORDS.md](../architecture/ARCHITECTURE-DECISION-RECORDS.md)

---

## Frozen

- Runtime pipeline: `Rule → Playbook → LLM → Decision`
- No new rules, playbooks, or rule-engine behavior in Sprint 5A
- Demo regulation seeds unchanged until a future KOS import sprint
