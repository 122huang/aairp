# Sprint 5B-1 — Skill Corpus Plugin

**Status:** Implemented — Sprint 5B-1  
**Theme:** First Knowledge Asset expansion sprint — Skill Corpus on Knowledge Platform Core  
**Master roadmap:** [KNOWLEDGE-ROADMAP-v1.0.md](../knowledge/KNOWLEDGE-ROADMAP-v1.0.md)  
**Platform:** [SPRINT-5B-E0-KNOWLEDGE-PLATFORM-CORE.md](./SPRINT-5B-E0-KNOWLEDGE-PLATFORM-CORE.md) (frozen)

---

## Constraints (non-negotiable)

| Constraint | Implication |
|------------|-------------|
| Runtime pipeline frozen | No changes to `Rule → Playbook → LLM → Decision` |
| `skill-modules.json` frozen for consumers | `loadSkillModules()`, linkage validator, module eval dashboard, benchmark v3 generator **unchanged** |
| Knowledge Platform Core frozen | Extend via **new plugin**; do not fork governance |
| No production runtime loading | Skill Corpus is git + governance only until a future approved import sprint |
| No hardcoded business logic in code | Skills are **authored JSON**; plugin validates and reports |

---

## 1. Current architecture understanding

### 1.1 Frozen layers

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Platform Core (5B-E0) — FROZEN                     │
│  KnowledgeEntry · KnowledgeLinkage · Lifecycle · Governance   │
│  KnowledgeCorpusPlugin · registerCorpusPlugin()               │
└───────────────────────────┬─────────────────────────────────┘
                            │ implements
              ┌─────────────┴─────────────┐
              ▼                           ▼
   Regulation Corpus plugin ✓      Skill Corpus plugin (5B-1)
```

### 1.2 Legacy skill assets (remain authoritative for eval/runtime-adjacent tools)

| Asset | Role today | 5B-1 treatment |
|-------|------------|----------------|
| `docs/knowledge/skill-modules.json` | 8 modules, 13 patterns, golden-issue map | **Unchanged** — still consumed by eval, health, linkage |
| `packages/.../skill-modules.ts` | Loader + types | **Unchanged** |
| `demo/playbook.demo.md` | Runtime playbook patterns | **Unchanged** |
| `benchmark/benchmark-v3.json` | `expected_skill`, `expected_pattern`, `expected_rule` | **Unchanged** — skill corpus links *to* cases |

### 1.3 Regulation Corpus precedent (template for 5B-1)

| Layer | Regulation (frozen) | Skill (5B-1 target) |
|-------|---------------------|---------------------|
| Source files | `docs/knowledge/regulation-corpus/regulations/{CC}/*.json` | `docs/knowledge/skill-corpus/skills/*.json` |
| Loader | `regulation-corpus.ts` | `skill-corpus.ts` |
| Adapter | `regulation-entry.adapter.ts` | `skill-entry.adapter.ts` |
| Plugin | `regulation-corpus.plugin.ts` | `skill-corpus.plugin.ts` |
| Facades | `regulation-corpus-*.ts` | `skill-corpus-*.ts` |
| Manifest | `regulation-corpus.manifest.json` | `skill-corpus.manifest.json` |
| Platform registry | `registerCorpusPlugin('regulation')` | `registerCorpusPlugin('skill')` |

### 1.4 Linkage chain (target semantics)

```
Regulation (knowledge_id) → Rule (rule_id) → Skill (knowledge_id) → Benchmark (case_id) → Evaluation
                                    ↘ Rewrite (template_id) ↗
                                    ↘ Evidence (future)      ↗
```

Today the **center** of this chain is `skill-modules.json` (display names like `Claim Review`). Sprint 5B-1 introduces **canonical skill knowledge entries** with `knowledge_id` (e.g. `skill:health-claim-review`) while preserving backward compatibility via explicit `legacy_skill_module` and `legacy_pattern_ids` fields.

### 1.5 Conceptual distinction (important)

| Concept | Legacy (`skill-modules.json`) | New (Skill Corpus) |
|---------|------------------------------|---------------------|
| Unit | **Skill module** (capability bucket) | **Skill knowledge entry** (atomic advertising review skill) |
| Count | 8 modules / 13 patterns | **5 foundation skills** in 5B-1 (expand later) |
| ID | `skill_module` string (display name) | `skill_id` slug + `knowledge_id` |
| Purpose | Eval scope + ownership grouping | Executable knowledge contract (input → detect → decide → output) |

5B-1 **does not** replace the 8 modules. It **decomposes** advertising claim review into five authored skills that **map to** legacy modules/patterns/rules for linkage governance.

---

## 2. Sprint 5B-1 objectives mapping

| Objective | Approach |
|-----------|----------|
| Skill Corpus as Knowledge Corpus | `corpus_type: "skill"` file-per-entry under `skill-corpus/` |
| Reuse KnowledgeEntry / knowledge_id | Shared envelope + skill payload schema |
| No disconnected storage | Single plugin on Knowledge Platform; no parallel skill DB |
| Rich skill fields | Skill-specific schema (see §4) |
| Advertising Review foundation | 5 sample entries (see §5) |
| Regulation → Rule → Skill → Benchmark → Eval | `KnowledgeLinkage` on each entry + validator checks |

---

## 3. Proposed epic breakdown

| Epic | Scope | Outcome |
|------|-------|---------|
| **E1** | Schema & taxonomy | JSON Schema + `skill-claim-types.json` + `SKILL-CORPUS.md` |
| **E2** | Five sample skill entries | Authored JSON for foundation advertising skills |
| **E3** | Loader + adapter | `skill-corpus.ts`, `skill-entry.adapter.ts` |
| **E4** | Platform plugin | `skill-corpus.plugin.ts` + register in `knowledge-platform.ts` |
| **E5** | Governance facades | Validator, coverage, KQS, index, dashboard, CLI commands |
| **E6** | Tests | `skill-corpus.spec.ts`, `skill-corpus-governance.spec.ts`, platform snapshot |
| **E7** | Docs | Authoring standard §2.2 update, roadmap KPI note, sprint README |
| **E8** | Drift report (read-only) | Compare skill corpus ↔ `skill-modules.json` linkage; warn only |

**Explicitly out of scope for 5B-1:**

- Migrating or deleting `skill-modules.json`
- Changing `linkage-validator.ts` to require skill corpus (optional read-only cross-check in E8)
- KOS import, Knowledge Pack fingerprint (5B-4)
- Rewrite Corpus plugin (5B-2)
- Runtime skill execution / playbook routing

---

## 4. Schema design

### 4.1 File layout

```
docs/knowledge/skill-corpus/
  README.md
  skill-claim-types.json          # taxonomy for advertising review skills
  skill-corpus.manifest.json      # generated
  schemas/
    skill-corpus-entry.schema.json
  skills/
    health-claim-review.json
    superlative-claim-review.json
    comparative-claim-review.json
    certification-claim-review.json
    performance-claim-review.json
```

### 4.2 Envelope (shared — unchanged)

From `knowledge-corpus.schema.json`: `knowledge_id`, `corpus_type`, `owner`, `owner_type`, `last_reviewed`, `review_status`, optional `tags`.

### 4.3 Skill-specific payload

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `skill_id` | string slug | ✓ | Stable key; suffix of `knowledge_id` |
| `skill_purpose` | string | ✓ | Why this skill exists (plain language) |
| `input_definition` | object | ✓ | What the skill consumes (see below) |
| `detection_patterns` | array | ✓ | Pattern definitions (see below) |
| `decision_logic` | object | ✓ | Escalation / severity rules (declarative, not code) |
| `output_schema` | object | ✓ | Expected review output shape (declarative) |
| `linkage` | KnowledgeLinkage | ✓ | Cross-corpus links (canonical) |
| `legacy_skill_module` | string | optional | Maps to `skill-modules.json` module name |
| `legacy_pattern_ids` | string[] | optional | Maps to playbook pattern IDs |
| `confidence_level` | enum | optional | Promoted field (or tag during migration) |
| `evidence_requirement` | enum | optional | `none` \| `recommended` \| `required` |

**`input_definition`**

```json
{
  "modalities": ["text", "image"],
  "countries": ["SG", "MY", "TH"],
  "categories": ["health.supplement", "sa.*"],
  "claim_types": ["health-claim"],
  "required_context": ["product_category", "ad_copy"]
}
```

**`detection_patterns[]`**

```json
{
  "pattern_id": "sa-health-implication",
  "description": "Implied health benefit on non-health product",
  "signal_terms": ["healthier", "lower sugar"],
  "signal_concepts": ["nutritional benefit"],
  "playbook_pattern_id": "sa-health-implication"
}
```

**`decision_logic`**

```json
{
  "default_decision": "WARN",
  "escalation_policy": {
    "blocker_rule_present": "REJECT",
    "unverified_high_severity": "REVIEW",
    "default": "WARN"
  },
  "severity_map": {
    "blocker": "HIGH",
    "default": "MEDIUM"
  }
}
```

**`output_schema`**

```json
{
  "decision": "REJECT | REVIEW | WARN | PASS",
  "fields": ["matched_patterns", "matched_rules", "rationale", "rewrite_guidance_ref"],
  "rewrite_linkage": ["rewrite:qualify-efficacy"]
}
```

### 4.4 Linkage model (per entry)

| Linkage key | 5B-1 content | Validator checks against |
|-------------|--------------|--------------------------|
| `linkage.regulations` | `regulation:…` IDs | Regulation corpus loader |
| `linkage.rules` | `demo-*` rule IDs | `demo/rules.demo.json` |
| `linkage.rewrites` | `rewrite:{template_id}` | `rewrite-templates.json` (IDs only) |
| `linkage.benchmarks` | Benchmark `case_id` refs | `benchmark-v3.json` cases |
| `linkage.skills` | Parent/related skills | Other skill corpus entries |

### 4.5 Schema file changes

| File | Change |
|------|--------|
| `docs/knowledge/skill-corpus/schemas/skill-corpus-entry.schema.json` | **New** — `allOf` envelope + skill payload |
| `docs/knowledge/regulation-corpus/schemas/knowledge-corpus.schema.json` | **No change** (frozen) |
| `packages/.../knowledge-corpus.ts` | **No change** unless adding optional re-exports |

---

## 5. Five foundation skill entries (E2)

| skill_id | knowledge_id | Legacy mapping | Primary rules (linkage.rules) |
|----------|--------------|----------------|-------------------------------|
| `health-claim-review` | `skill:health-claim-review` | Claim Review → health patterns | `demo-sg-health-forbidden-claim`, `demo-apac-sa-health-claim-blocker`, `demo-apac-sa-health-implication` |
| `superlative-claim-review` | `skill:superlative-claim-review` | Claim Review → absolute/superlative | `demo-sg-health-superlative`, `demo-apac-sa-absolute-claim`, `demo-apac-sa-absolute-claim-soft` |
| `comparative-claim-review` | `skill:comparative-claim-review` | Claim Review → comparative patterns | `demo-apac-sa-comparative-claim` |
| `certification-claim-review` | `skill:certification-claim-review` | Evidence Review | `demo-apac-sa-certification-evidence`, `demo-apac-sa-patent-claim` |
| `performance-claim-review` | `skill:performance-claim-review` | Claim Review → performance/capacity | `demo-apac-sa-performance-claim`, `demo-apac-sa-capacity-claim` |

Each entry will include:

- `linkage.regulations` — 1–3 relevant `regulation:…` IDs from Regulation Corpus (where mapped)
- `linkage.rewrites` — e.g. `rewrite:qualify-efficacy`, `rewrite:qualify-comparative`
- `linkage.benchmarks` — subset of benchmark-v3 `case_id` values for that skill
- `evidence_requirement` — per Authoring Standard mapping (health/comparative/performance → `required`; etc.)
- `review_guidance` — TRIGGER / ACTION / CHECK / ESCALATE IF format

---

## 6. Implementation modules

### 6.1 New files

| Path | Purpose |
|------|---------|
| `docs/knowledge/skill-corpus/**` | Source of truth + schemas + 5 JSON entries |
| `docs/knowledge/SKILL-CORPUS.md` | Authoring guide |
| `docs/sprint-5/SPRINT-5B-1-PLAN.md` | This plan |
| `packages/.../knowledge/skill-corpus.ts` | Loader, normalize, types |
| `packages/.../knowledge/corpus/skill-entry.adapter.ts` | `KnowledgeLinkage` builder |
| `packages/.../knowledge/corpus/skill-corpus.plugin.ts` | Platform plugin |
| `packages/.../knowledge/skill-corpus-validator.ts` | Facade → platform validator |
| `packages/.../knowledge/skill-corpus-coverage.ts` | Facade → platform coverage |
| `packages/.../knowledge/skill-corpus-kqs.ts` | Facade → platform KQS |
| `packages/.../knowledge/skill-corpus-index.ts` | Manifest writer |
| `packages/.../knowledge/skill-corpus-dashboard.ts` | Dashboard writer |
| `packages/.../knowledge/skill-corpus.spec.ts` | Loader tests |
| `packages/.../knowledge/skill-corpus-governance.spec.ts` | Governance tests |
| `packages/.../knowledge/run-build-skill-corpus-index.ts` | CLI |
| `packages/.../knowledge/run-validate-skill-corpus.ts` | CLI |
| `packages/.../knowledge/run-skill-corpus-dashboard.ts` | CLI |
| `packages/.../knowledge/run-skill-corpus-coverage-report.ts` | CLI |

### 6.2 Modified files (minimal)

| Path | Change |
|------|--------|
| `packages/.../platform/knowledge-platform.ts` | Register `skillCorpusPlugin` |
| `packages/application/package.json` | Add `knowledge:*-skill-corpus-*` scripts |
| `package.json` (root) | Wire scripts |
| `docs/knowledge/KNOWLEDGE-AUTHORING-STANDARD.md` | §2.2 Skill Corpus citation + skill fields |
| `docs/sprint-5/README.md` | 5B-1 status |
| `docs/knowledge/KNOWLEDGE-ROADMAP-v1.0.md` | §2.2 Skill row → plugin registered (after implementation) |

### 6.3 Files explicitly NOT modified

| Path | Reason |
|------|--------|
| `demo/playbook.demo.md` | Runtime frozen |
| `demo/rules.demo.json` | Runtime frozen |
| `docs/knowledge/skill-modules.json` | Eval/linkage consumer frozen |
| `packages/.../skill-modules.ts` | Loader frozen |
| `packages/.../linkage-validator.ts` | Runtime-adjacent; E8 read-only report only |
| `packages/.../review/**` | Runtime pipeline |
| `regulation-corpus/**` | 5A frozen |

---

## 7. Governance (plugin responsibilities)

### 7.1 KQS dimensions (skill-specific + shared)

| Dimension | Measures |
|-----------|----------|
| `skill_purpose` | Purpose field completeness |
| `input_definition` | Required input fields present |
| `detection_patterns` | ≥1 pattern with playbook cross-ref |
| `decision_logic` | Escalation policy present |
| `output_schema` | Output fields declared |
| `regulation_linkage` | ≥1 regulation knowledge_id (warn if 0) |
| `rule_linkage` | ≥1 valid rule ID |
| `benchmark_linkage` | ≥1 benchmark case_id |
| + shared | summary, review_guidance, confidence, evidence |

### 7.2 Coverage axes

| Axis | Metrics |
|------|---------|
| Claim type | 5 foundation types covered |
| Legacy module | Mapping coverage to 8 modules |
| Rule linkage | % demo rules referenced |
| Benchmark linkage | % benchmark cases with skill entry |

### 7.3 Validator errors vs warnings

| Code | Severity |
|------|----------|
| Invalid envelope / duplicate `knowledge_id` | Error |
| Unknown `linkage.rules` ID | Error |
| Unknown `linkage.regulations` ID | Error |
| Unknown `linkage.benchmarks` case_id | Error |
| Unknown `rewrite:` ID | Warning (until Rewrite Corpus plugin) |
| Missing regulation linkage | Warning |
| Orphan (no rules) | Warning |
| Drift from `skill-modules.json` | Warning (E8) |

---

## 8. Commands (planned)

```bash
pnpm knowledge:build-skill-corpus-index
pnpm knowledge:validate-skill-corpus
pnpm knowledge:skill-corpus-coverage-report
pnpm knowledge:skill-corpus-dashboard
pnpm knowledge:platform-dashboard          # includes skill after registration
```

---

## 9. Risks and conflicts

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Duplication** with `skill-modules.json` | High | `legacy_*` fields + E8 drift report; document dual-layer model |
| **Naming confusion** (`skill_module` vs `skill_id`) | Medium | Glossary in SKILL-CORPUS.md; no rename of legacy fields |
| **Linkage validator divergence** | Medium | Skill corpus has own validator; E8 optional cross-check only |
| **Scope creep** into runtime routing | Medium | PR checklist: zero imports from `review/` in new skill corpus code |
| **Platform SDK change** | Low | Plugin-only extension; no `corpus-sdk.ts` interface changes |
| **Benchmark field naming** (`expected_skill` vs `knowledge_id`) | Medium | Link via `legacy_skill_module` + `case_id`; full ID bridge in 5D/6+ |
| **Rewrite linkage before Rewrite Corpus** | Low | Use `rewrite:{template_id}` convention; warn until 5B-2 |

### Frozen architecture compliance

| Check | Pass? |
|-------|-------|
| No runtime pipeline edits | ✓ Planned |
| No skill-modules.json mutation | ✓ Planned |
| Uses KnowledgeCorpusPlugin | ✓ Planned |
| Reporting-only governance | ✓ Planned |
| Versioned git source + manifest | ✓ Planned |

---

## 10. Acceptance criteria

- [ ] Five skill entries under `skill-corpus/skills/` with valid envelope + payload
- [ ] `skill-corpus-entry.schema.json` validates all entries
- [ ] Skill plugin registered; `pnpm knowledge:platform-dashboard` shows 2 corpora
- [ ] Validator: **0 errors** on sample entries
- [ ] Each skill links to ≥1 rule, ≥1 benchmark case, declares evidence/confidence
- [ ] KQS, coverage, freshness, dashboard reports generated
- [ ] Tests pass; `skill-modules.json` byte-identical unless explicitly approved
- [ ] SKILL-CORPUS.md + Authoring Standard updated
- [ ] **Zero** runtime / review / playbook engine changes

---

## 11. Open questions for review

1. **Entry granularity:** Confirm one JSON file per **atomic skill** (5 files) vs one file per legacy module (8 files). Plan recommends **5 atomic advertising skills** for 5B-1.
2. **`detection_patterns` vs playbook:** Should every `playbook_pattern_id` be required to exist in `demo/playbook.demo.md` (strict) or warn-only?
3. **Regulation linkage:** Require ≥1 `regulation:knowledge_id` per skill in 5B-1, or warn-only until legal mapping pass?
4. **E8 drift report:** Ship in 5B-1 or defer to 5B-1.1?

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-30 | Initial Sprint 5B-1 plan — analysis only, no implementation |
