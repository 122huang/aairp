# Sprint 4A — Schema, Generation, Evaluation, Health

**Status:** Approved — ready for implementation  
**Theme:** Executable Knowledge System (foundation layer)  
**Duration:** 2 weeks  
**ADR:** [ADR-004](../adr/ADR-004-executable-knowledge-system.md)

---

## 1. Sprint 4A Goal

Deliver the **measurement and schema layer** of the Executable Knowledge System:

1. Skill Module Contracts (metadata only — no runtime effect)
2. benchmark-v3 schema + generator (quality specification)
3. Evaluation framework (dimension scoring + module rollup)
4. Knowledge Health Report (ownership + freshness + pass rate)

**No runtime changes.** Pipeline remains `Rule → Playbook → LLM → Decision`.

---

## 2. Scope Boundaries

### In scope (Sprint 4A only)

| ID | Deliverable |
|----|-------------|
| S4A-1 | `skill-modules.json` schema + migration from `skill-taxonomy.json` |
| S4A-2 | Ownership metadata on skill modules (+ schema for regulation/rule) |
| S4A-3 | `benchmark/benchmark-v3.json` generator |
| S4A-4 | `benchmark/benchmark-promotion-queue.json` schema + stub workflow |
| S4A-5 | Rewrite template library (structured matchers) |
| S4A-6 | `runBenchmarkV3Eval()` evaluation framework |
| S4A-7 | Knowledge Health Report (`pnpm knowledge:health-report`) |
| S4A-8 | Eval reports stamp `knowledge_pack_version` + fingerprint |
| S4A-9 | JSON Schemas + tests + documentation |

### Out of scope (defer to 4B/4C)

- CI hard gate (`--strict` blocking)
- Skill Module Accuracy Dashboard UI
- KOS pack export (`kos:export-pack`)
- Case library → promotion queue automation (stub only in 4A)
- Runtime Skill config injection
- Ownership fields in KOS DB migration (schema defined; DB in 4B)

---

## 3. Epic Breakdown

### Epic E1 — Skill Module Contract Schema (Days 1–2)

**Owner:** Knowledge Engineering

| Story | Tasks | Output |
|-------|-------|--------|
| E1-S1 | Define `skill-modules.schema.json` | `docs/sprint-4/schemas/` |
| E1-S2 | Migrate `skill-taxonomy.json` → `docs/knowledge/skill-modules.json` | Superset with SMC fields |
| E1-S3 | Add ownership defaults to all 8 modules | `owner`, `owner_type`, `last_reviewed_at`, `freshness_status` |
| E1-S4 | Populate `applicable_rules`, `activation_conditions`, `escalation_policy` from taxonomy + rules | Metadata only |
| E1-S5 | Deprecation shim: `loadSkillTaxonomy()` reads `skill-modules.json` | Backward compat |
| E1-S6 | Update `SKILL-TAXONOMY.md` → `SKILL-MODULES.md` (or section in ADR) | Docs |

**Acceptance criteria:**
- [ ] All 13 patterns assigned to modules with full SMC
- [ ] `skill-taxonomy.json` marked deprecated; tests pass via shim
- [ ] No runtime code reads `activation_conditions` or `escalation_policy`

---

### Epic E2 — Ownership & Freshness Model (Days 2–3)

| Story | Tasks | Output |
|-------|-------|--------|
| E2-S1 | Define `OwnershipMetadata` type in shared-kernel | `owner`, `owner_type`, `last_reviewed_at`, `freshness_status` |
| E2-S2 | Extend regulation/rule seed schemas (demo) with ownership | `demo-knowledge-paths.ts` |
| E2-S3 | Implement `computeFreshnessStatus(lastReviewedAt, evalPassed)` | Pure function + tests |
| E2-S4 | Document `owner_type` enum and assignment rules | ADR appendix |

**owner_type values:**

| Value | Typical owner |
|-------|---------------|
| `legal` | Legal counsel / country legal lead |
| `knowledge_eng` | Knowledge engineering team |
| `compliance` | Compliance operations |
| `product` | Product / pilot owner |

**Acceptance criteria:**
- [ ] Freshness computation tested for all 4 statuses
- [ ] Skill modules have non-empty `owner` and `owner_type`

---

### Epic E3 — Benchmark V3 Schema & Generator (Days 3–5)

| Story | Tasks | Output |
|-------|-------|--------|
| E3-S1 | Define `benchmark-v3.schema.json` | Schema file |
| E3-S2 | Implement `scripts/build-benchmark-v3.mjs` | Generator |
| E3-S3 | v3 generator inputs: golden + skill-modules + v2 + promotion queue + overrides | No manual v3 editing |
| E3-S4 | Derive `expected_action` from `expected_decision` + escalation_policy (metadata) | Deterministic mapping |
| E3-S5 | Derive `expected_rewrite` from pattern `suggested_rewrite` + rewrite templates | Structured output |
| E3-S6 | Assign `evaluation_weight` + `tier` (regression subset from ad-manifest + golden critical) | Weighted eval ready |
| E3-S7 | `pnpm knowledge:build-benchmark-v3` npm script | CLI |
| E3-S8 | Promotion queue schema: `benchmark/benchmark-promotion-queue.json` | Lifecycle stub |

**Benchmark lifecycle (Sprint 4A — schema + stub):**

```json
{
  "queue_version": "1.0.0",
  "candidates": [
    {
      "candidate_id": "promo-case_abc123",
      "source_case_id": "case_abc123",
      "source_review_id": "rev_xyz",
      "lifecycle_status": "BENCHMARK_CANDIDATE",
      "proposed_tier": "candidate",
      "skill_module": "Claim Review",
      "pattern_id": "sa-absolute-performance",
      "verified_by_legal": false,
      "submitted_at": "2026-06-30T00:00:00.000Z",
      "owner": "legal-apac@example.com"
    }
  ]
}
```

**expected_action derivation (deterministic, no runtime):**

| expected_decision | Default expected_action |
|-------------------|-------------------------|
| PASS | PASS |
| WARN | REWRITE |
| REJECT | REJECT |
| REVIEW | ESCALATE |

Override via `benchmark-v3.overrides.json` only.

**Acceptance criteria:**
- [ ] v3 case count ≥ v2 case count
- [ ] All `tier: regression` cases have full v3 fields
- [ ] Generator idempotent
- [ ] `content_fingerprint` on v3 manifest

---

### Epic E4 — Rewrite Template Library (Days 4–5)

| Story | Tasks | Output |
|-------|-------|--------|
| E4-S1 | Define rewrite templates JSON | `docs/knowledge/rewrite-templates.json` |
| E4-S2 | Implement `matchRewriteExpectation(actual, expected_rewrite)` | Pure matcher |
| E4-S3 | Strategies: `qualify`, `remove`, `disclose`, `cite_evidence` | Initial 4 templates |
| E4-S4 | Unit tests with AF-002 absolute claim example | Spec file |

**Matcher contract (no LLM):**

```typescript
type RewriteExpectation = {
  strategy: 'qualify' | 'remove' | 'disclose' | 'cite_evidence';
  must_remove_terms?: string[];
  must_include_concepts?: string[];
  template_id?: string;
};
// Returns: { passed: boolean; score: number; failures: string[] }
```

---

### Epic E5 — Evaluation Framework (Days 6–8)

| Story | Tasks | Output |
|-------|-------|--------|
| E5-S1 | `BenchmarkV3EvalMetrics` type | dimension + module scores |
| E5-S2 | `runBenchmarkV3Eval()` — reuses existing pipeline, adds v3 assertions | Service |
| E5-S3 | Per-dimension scoring: decision, pattern_hit, severity, action, rewrite | `eval-v3-metrics.ts` |
| E5-S4 | Per-module rollup keyed by `expected_skill` | Module accuracy table |
| E5-S5 | Weighted quality score from `evaluation_profile` | Single headline metric |
| E5-S6 | Report: JSON + Markdown with Knowledge Pack version header | `reports/eval-v3-*.md` |
| E5-S7 | `pnpm eval:benchmark-v3` CLI | npm script |
| E5-S8 | Tests against regression tier subset | Spec |

**Eval report header (required):**

```markdown
# Benchmark V3 Evaluation Report
**Knowledge Pack:** kp-2026.07.xxx
**Fingerprint:** 56cfe46c...
**Benchmark:** aairp-benchmark-v3 (schema 3.0.0)
**Evaluated at:** 2026-07-15T...
```

**Acceptance criteria:**
- [ ] Regression tier eval completes without LLM (or with existing skip rules)
- [ ] Module rollup table produced for all 8 modules with cases
- [ ] Weighted score ∈ [0, 1]
- [ ] Existing `eval:benchmark` and `eval:golden` unchanged

---

### Epic E6 — Knowledge Health Report (Days 8–9)

| Story | Tasks | Output |
|-------|-------|--------|
| E6-S1 | Extend `knowledge-coverage.ts` → `knowledge-health.ts` | Superset |
| E6-S2 | KPI: ownership coverage (% objects with owner) | |
| E6-S3 | KPI: freshness distribution | |
| E6-S4 | KPI: benchmark pass rate (from last v3 eval if present) | |
| E6-S5 | KPI: rule effectiveness (per-rule from v3 eval) | |
| E6-S6 | KPI: FP/FN rates by module | |
| E6-S7 | KPI: linkage orphan count | |
| E6-S8 | `pnpm knowledge:health-report` CLI | npm script |
| E6-S9 | Deprecate standalone coverage report call → health report includes coverage | |

**Acceptance criteria:**
- [ ] Health report includes inventory + coverage % (Sprint 3 compat)
- [ ] All 6 KPIs present with counts and percentages
- [ ] Objects missing `owner` listed in accountability section
- [ ] Stale objects listed with recommended action

---

### Epic E7 — Knowledge Pack Manifest V2 (Day 10)

| Story | Tasks | Output |
|-------|-------|--------|
| E7-S1 | Extend pack manifest with `skill_modules_version`, `benchmark_v3_fingerprint` | |
| E7-S2 | Add `evaluation_profile` defaults to manifest | |
| E7-S3 | Add `ownership_summary` block | |
| E7-S4 | Update `pnpm knowledge:pack-manifest` | |
| E7-S5 | Wire: build-v3 → pack-manifest in documented workflow | README |

---

## 4. File Plan (new / modified)

| Path | Action |
|------|--------|
| `docs/adr/ADR-004-executable-knowledge-system.md` | Created (this ADR) |
| `docs/knowledge/skill-modules.json` | **New** — canonical SMC export |
| `docs/knowledge/skill-taxonomy.json` | Deprecated (shim reads modules) |
| `docs/knowledge/rewrite-templates.json` | **New** |
| `docs/knowledge/SKILL-MODULES.md` | **New** — human-readable |
| `docs/sprint-4/schemas/*.schema.json` | **New** |
| `benchmark/benchmark-v3.json` | **Generated** |
| `benchmark/benchmark-v3.overrides.json` | **New** — exceptions only |
| `benchmark/benchmark-promotion-queue.json` | **New** — lifecycle stub |
| `scripts/build-benchmark-v3.mjs` | **New** |
| `packages/application/src/evaluation/benchmark-v3-*.ts` | **New** |
| `packages/application/src/knowledge/knowledge-health.ts` | **New** |
| `packages/application/src/knowledge/skill-modules.ts` | **New** (replaces taxonomy loader) |

**Unchanged runtime paths:** `demo/`, `benchmark/ad-manifest.json`, `scripts/golden-benchmark-v1-cases.json`, review pipeline services.

---

## 5. Implementation Order

```
Week 1
  Day 1–2   E1 Skill Module Contract schema + migration
  Day 2–3   E2 Ownership & freshness model
  Day 3–5   E3 Benchmark v3 generator
  Day 4–5   E4 Rewrite templates (parallel with E3)

Week 2
  Day 6–8   E5 Evaluation framework
  Day 8–9   E6 Knowledge Health Report
  Day 10    E7 Pack manifest v2 + integration tests + docs
```

**Critical path:** E1 → E3 → E5 → E6 → E7

---

## 6. Testing Strategy

| Layer | Tests |
|-------|-------|
| Schema | JSON Schema validation in CI |
| Generator | Idempotency; v3 ⊇ v2 field compatibility |
| Rewrite matcher | Unit tests per strategy |
| Eval framework | Regression tier snapshot; module rollup sums |
| Health report | KPI presence; ownership gap detection |
| Regression guard | `rule-engine`, `playbook-engine`, `benchmark-regression` specs still pass |

**No new CI blocking in 4A** — all new commands informational.

---

## 7. Commands (after Sprint 4A)

```bash
pnpm knowledge:build-benchmark-v3    # Generate benchmark-v3.json
pnpm eval:benchmark-v3             # Run v3 evaluation + report
pnpm knowledge:health-report         # Ownership + freshness + pass rate KPIs
pnpm knowledge:validate-linkage      # Unchanged (linkage)
pnpm knowledge:pack-manifest         # Extended manifest
```

---

## 8. Definition of Done (Sprint 4A)

- [ ] ADR-004 published with approved constraints
- [ ] `skill-modules.json` is canonical SMC; taxonomy shim works
- [ ] benchmark-v3 generated; regression tier fully populated
- [ ] Promotion queue schema exists with documented lifecycle
- [ ] v3 eval produces dimension + module scores + weighted quality score
- [ ] Health report includes 6 KPIs + ownership accountability section
- [ ] All eval/health reports stamp Knowledge Pack version + fingerprint
- [ ] Zero runtime pipeline behavior changes
- [ ] Zero new rules or patterns added
- [ ] Sprint 4A completion report with baseline v3 scores per module

---

## 9. Sprint 4B Preview (not in 4A)

- CI gate T2 (module eval threshold, soft → hard)
- KOS DB ownership columns + admin API
- Case library → promotion queue automation
- Skill Module Accuracy Dashboard (markdown/HTML)
- `kos:export-pack` toward single pack artifact

---

## 10. Open Items for Kickoff

| # | Question | Default if no answer |
|---|----------|----------------------|
| 1 | Default `owner` for demo skill modules | `knowledge-eng@aairp` |
| 2 | Regression tier size target | 12 cases (6 ad-manifest + 6 golden critical) |
| 3 | Weighted score baseline for "healthy" | ≥ 0.85 overall |
| 4 | Rewrite matcher strictness | `must_remove_terms` required; concepts optional |
| 5 | Deprecate `pnpm knowledge:coverage-report` | Alias to health-report in 4A |
