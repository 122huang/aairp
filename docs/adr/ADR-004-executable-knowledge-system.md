# ADR-004: Executable Knowledge System (EKS)

**Status:** Approved (revised 2026-06-30)  
**Supersedes:** Sprint 3 scope document (completed)  
**Sprint 4 theme:** Measure → Gate → Operate (not Accumulate)

---

## 1. Context

Sprint 3 delivered a **Knowledge Foundation**: Skill Taxonomy, playbook metadata, benchmark-v2 (generated), linkage validator, coverage report, regulation metadata, and Knowledge Pack manifest with SHA-256 fingerprint.

The system can answer *what knowledge exists* and *how objects link*. It cannot yet answer *whether knowledge is good*, *who owns it*, or *whether a release is safe*.

Sprint 4 evolves AAIRP from a **static knowledge repository** into an **Executable Knowledge System (EKS)** — without changing the review runtime pipeline.

---

## 2. Decision Summary

| # | Decision | Status |
|---|----------|--------|
| D1 | Sprint 4 = **Executable Knowledge System**, not rule/pattern expansion | **Approved** |
| D2 | Skill Module = **operational/evaluation contract** (metadata, eval, governance) | **Approved** |
| D3 | **No Skill Engine** or router layer in Sprint 4; runtime frozen | **Approved** |
| D4 | benchmark-v3 = **quality specification** with weighted dimensions | **Approved** |
| D5 | Knowledge Pack = **immutable release unit** for runtime + evaluation | **Approved** |
| D6 | Knowledge source converges: **KOS → Knowledge Pack → Runtime/Eval artifacts** | **Approved** |
| D7 | Benchmark lifecycle: **Case → Verified → Candidate → Regression** | **Approved** |
| D8 | Knowledge Health includes **ownership metadata** for accountability | **Approved** |
| D9 | Reject Pattern Library, knowledge graph, large rule expansion, runtime refactor | **Affirmed** |

---

## 3. Frozen Runtime Architecture

```
Regulation → Rule → Playbook → LLM → Decision → Report → Case Library
```

**Sprint 4 constraint:** Pipeline shape and decision fusion logic are **frozen**.

Skill Module Contracts (SMC) may influence:
- Evaluation routing and scoring
- Knowledge health and governance reports
- Knowledge Pack manifest content
- Future (post–Sprint 4) report/LLM context hints — **not Sprint 4A**

Skill Module Contracts must **not** influence in Sprint 4:
- Rule matching order or outcomes
- Playbook pattern activation
- Decision engine fusion weights
- New orchestration layers between pipeline stages

---

## 4. Knowledge Source Governance

### 4.1 Problem (Sprint 3)

Multiple parallel sources exist today:

| Artifact | Role today |
|----------|------------|
| `docs/knowledge/skill-taxonomy.json` | Canonical taxonomy + golden issue map |
| `demo/playbook.demo.md` | Runtime playbook patterns |
| `demo/rules.demo.json` | Runtime rules |
| KOS (PostgreSQL) | Operational store with publish/rollback |
| `benchmark/benchmark-v2.json` | Generated benchmark |

Risk: taxonomy, playbook, KOS, and benchmark drift independently.

### 4.2 Target model (long-term)

```
┌─────────────────────────────────────────────────────────┐
│  KOS (authoring, versioning, ownership, publish)         │
│  Single operational source of truth                      │
└───────────────────────────┬─────────────────────────────┘
                            │ publish
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Knowledge Pack (immutable release artifact)             │
│  knowledge_pack_version + fingerprint                  │
│  regulations · rules · skill-modules · patterns ·        │
│  benchmark-v3 · ownership snapshot                     │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
                ▼                     ▼
        Runtime snapshot         Evaluation artifacts
        (demo files today;       (benchmark-v3 eval,
         KOS gateway later)        health report, gate)
```

### 4.3 Sprint 4 convergence rules

| Rule | Detail |
|------|--------|
| **K1** | KOS is the **authoritative editor** for regulations, rules, playbooks, skill module contracts |
| **K2** | `skill-modules.json` is a **published export** from KOS/taxonomy — not a parallel authoring surface |
| **K3** | `demo/*` files remain runtime paths in Sprint 4 but are treated as **pack snapshots** produced by `kos:import-demo` + pack build |
| **K4** | `skill-taxonomy.json` is **deprecated as authoring** in Sprint 4A; evolves into `skill-modules.json` export schema |
| **K5** | benchmark-v3 is **generated only** from golden + pack exports + promotion queue — never hand-maintained |
| **K6** | Evaluation and health tools read **Knowledge Pack manifest** version/fingerprint, not loose files |

### 4.4 Migration path (non-breaking)

1. **Sprint 4A:** Introduce `skill-modules.json` as superset of taxonomy; generator reads it; taxonomy file remains for backward compat (read-only alias).
2. **Sprint 4B:** Pack manifest embeds skill-modules fingerprint; eval reports stamp pack version.
3. **Sprint 4C:** `kos:export-pack` produces full pack directory; demo files become export targets.
4. **Sprint 5+:** Runtime gateway loads from published pack only when `AAIRP_KNOWLEDGE_SOURCE=kos`.

---

## 5. Skill Module Contract (SMC)

### 5.1 Purpose

Skill Module evolves from **taxonomy label** to **operational/evaluation contract** — a grouping unit for patterns, rules, benchmarks, eval scores, and ownership.

### 5.2 Contract fields (Sprint 4)

```json
{
  "skill_module": "Claim Review",
  "description": "...",
  "owner": "legal-apac@example.com",
  "owner_type": "legal",
  "last_reviewed_at": "2026-06-15T00:00:00.000Z",
  "freshness_status": "current",
  "patterns": ["sa-absolute-performance", "..."],
  "applicable_rules": ["demo-apac-sa-absolute-claim", "..."],
  "benchmark_scope": { "skill_module": "Claim Review" },
  "activation_conditions": {
    "countries": ["SG", "MY", "TH"],
    "categories": ["sa.*"],
    "modalities": ["text", "image"]
  },
  "rewrite_strategy": {
    "default": "qualify",
    "pattern_overrides": {}
  },
  "escalation_policy": {
    "blocker_rule_present": "REJECT",
    "unverified_high_severity": "REVIEW",
    "default": "WARN"
  }
}
```

### 5.3 Sprint 4 constraints on SMC

| Field | Sprint 4 use | Runtime use |
|-------|--------------|-------------|
| `patterns`, `applicable_rules`, `benchmark_scope` | Linkage + eval routing | ❌ None |
| `activation_conditions` | Eval filter + health reporting | ❌ None |
| `rewrite_strategy` | benchmark-v3 `expected_rewrite` templates | ❌ None |
| `escalation_policy` | Eval expected_action derivation + docs | ❌ None |
| `owner`, `owner_type`, `last_reviewed_at`, `freshness_status` | Governance + health | ❌ None |

**Explicit rejection:** No Skill Engine, no module router, no runtime branch on `activation_conditions` or `escalation_policy` in Sprint 4.

Patterns remain the **only** playbook activation primitive (`PlaybookEngineService` unchanged).

---

## 6. Benchmark V3 — Quality Specification

### 6.1 Schema (approved dimensions)

benchmark-v3 extends v2 with:

| Field | Purpose |
|-------|---------|
| `expected_skill` | Module-level eval rollup |
| `expected_pattern` | Pattern hit assertion (alias of v2 `pattern_id`) |
| `expected_rule` | Rule linkage assertion |
| `expected_severity` | Severity accuracy |
| `expected_decision` | Decision accuracy |
| `expected_action` | `PASS` \| `WARN` \| `REJECT` \| `REWRITE` \| `ESCALATE` \| `REVIEW` |
| `expected_rewrite` | Structured rewrite spec (strategy + constraints) |
| `evaluation_weight` | Weighted quality score (0.0–1.0) |
| `tier` | `regression` \| `extended` \| `candidate` \| `pilot` |
| `lifecycle_status` | Promotion pipeline state |
| `verified_by_legal` | Human sign-off flag |
| `provenance` | Source case, promotion history |

### 6.2 Evaluation dimensions and default weights

| Dimension | Weight | Question |
|-----------|--------|----------|
| `decision` | 0.35 | Correct final decision? |
| `pattern_hit` | 0.20 | Correct pattern fired? |
| `severity` | 0.10 | Severity matches? |
| `action` | 0.15 | Correct action type? |
| `rewrite` | 0.20 | Structured rewrite constraints met? |

Weights configurable per `evaluation_profile` in Knowledge Pack manifest.

### 6.3 Benchmark lifecycle (approved)

```
Production Case (Case Library)
        │
        ▼  auto-save on review
   GENERATED
        │
        ▼  human feedback / pilot sign-off
   HUMAN_VERIFIED  (legal reviewer confirms decision + rewrite)
        │
        ▼  promotion script / KOS workflow
   BENCHMARK_CANDIDATE  (in promotion queue, tier=candidate)
        │
        ▼  legal approval + linkage validation + eval pass
   REGRESSION_BENCHMARK  (tier=regression, in benchmark-v3)
        │
        ▼  continuous eval on every pack change
   MAINTAINED  (or DEMOTED if eval regresses)
```

**Artifact:** `benchmark/benchmark-promotion-queue.json` — staging area between case library and v3.

**Rules:**
- Golden dataset (`scripts/golden-benchmark-v1-cases.json`) remains **historical source** for bulk generation; not edited for new cases.
- New production learning flows through **promotion queue → v3 regeneration**.
- `tier: regression` cases are CI-blocking (Sprint 4C); `extended` and `candidate` are informational until promoted.

### 6.4 Rewrite evaluation (Sprint 4)

Structured matchers only — **no LLM-as-judge**:

```json
{
  "expected_rewrite": {
    "strategy": "qualify",
    "must_remove_terms": ["perfect", "every time"],
    "must_include_concepts": ["typical results"],
    "template_id": "qualify-performance"
  }
}
```

Matcher scores rewrite suggestions from `recommendation` / playbook `suggested_rewrite` metadata — not live ad edits.

---

## 7. Knowledge Health & Ownership

### 7.1 Ownership metadata (approved)

Applied to: Regulation, Rule, Skill Module, Playbook Pattern, Benchmark Case (candidate+).

| Field | Type | Purpose |
|-------|------|---------|
| `owner` | string | Accountable person or team ID |
| `owner_type` | `legal` \| `knowledge_eng` \| `compliance` \| `product` | Role-based routing |
| `last_reviewed_at` | ISO datetime | Last human review timestamp |
| `freshness_status` | `current` \| `review_due` \| `stale` \| `deprecated` | Computed from dates + eval |

**Freshness rules (Sprint 4A):**

| Status | Condition |
|--------|-----------|
| `current` | Reviewed within 90 days AND last eval pass |
| `review_due` | Reviewed 90–180 days ago OR eval score dropped |
| `stale` | Not reviewed > 180 days |
| `deprecated` | Marked for removal; excluded from regression tier |

### 7.2 Knowledge Health Report (KHR) — 6 KPIs

| KPI | Source |
|-----|--------|
| Ownership coverage | % knowledge objects with `owner` |
| Freshness | % objects `current` vs `stale` |
| Benchmark pass rate | Last v3 weighted score |
| Rule effectiveness | Per-rule precision/recall from v3 eval |
| FP / FN rate | Module-level false reject + missed blocker |
| Linkage health | Orphan count from linkage validator |

KHR supersedes coverage-only reporting; coverage % remains as sub-metrics.

---

## 8. CI Knowledge Gate (Sprint 4 phased)

| Tier | Sprint | Mode | Criteria |
|------|--------|------|----------|
| T1 Linkage | 4A | informational → 4C hard | 0 linkage errors |
| T2 Module eval | 4B | informational | Per-module decision accuracy ≥ threshold |
| T3 Quality score | 4C | hard (regression tier) | Weighted score ≥ budget; 0 regression failures |
| T4 Release | 4C | deploy gate | T1–T3 + existing golden regression |

Gate artifact: `reports/knowledge-gate-{knowledge_pack_version}.json`

---

## 9. Sprint 4 Scope Control

### In scope

| Phase | Focus |
|-------|-------|
| **4A** | Schema evolution, benchmark-v3 generation, evaluation framework, knowledge health reporting |
| **4B** | Module eval dashboard, health KPI automation, gate T2 |
| **4C** | Knowledge gate T1+T3, promotion workflow, CI hard gate |
| **4D** | KOS pack export convergence, ownership in KOS admin |

### Explicitly out of scope (all of Sprint 4)

- Skill Engine or module router
- Pattern Library entity
- Runtime pipeline refactoring
- Large-scale rule expansion
- Knowledge graph
- LLM-as-judge for rewrite scoring
- New country regulation corpora (unless pilot-driven)

---

## 10. Long-Term Risks (carried forward)

| Risk | Mitigation |
|------|------------|
| Rule library complexity trap | Cap rule growth; promote via benchmark lifecycle |
| Parallel knowledge ownership | KOS → Pack → artifacts (Section 4) |
| False confidence from linkage-only coverage | v3 quality dimensions + weighted score |
| Static rewrite suggestions | Structured `expected_rewrite` in v3 |
| Governance without owners | Ownership metadata on all objects |

---

## 11. References

- Sprint 3 deliverables: `docs/sprint-3/README.md`
- Skill Taxonomy: `docs/knowledge/SKILL-TAXONOMY.md`
- Knowledge Pack: `benchmark/knowledge-pack.manifest.json`
- Benchmark V2: `benchmark/benchmark-v2.json`

---

## 12. Revision History

| Date | Change |
|------|--------|
| 2026-06-30 | Initial architecture review |
| 2026-06-30 | Approved with constraints: no Skill Engine, KOS→Pack governance, benchmark lifecycle, ownership metadata, Sprint 4A scope control |
