# Rewrite Corpus

**Corpus type:** `rewrite`  
**Schema:** [rewrite-corpus-entry.schema.json](./rewrite-corpus/schemas/rewrite-corpus-entry.schema.json)  
**Status:** Sprint 5B-2  
**Related:** [KNOWLEDGE-ROADMAP-v1.0.md](./KNOWLEDGE-ROADMAP-v1.0.md) · [SKILL-CORPUS.md](./SKILL-CORPUS.md)

---

## Purpose

The Rewrite Corpus defines **measurable rewrite guidance** for advertising compliance review. It answers: *How should non-compliant copy be revised?*

**Important:** Rewrite entries are **knowledge guidance only** — not a rewrite engine, LLM prompt pack, or generated text. Runtime and benchmark eval continue to consume `rewrite-templates.json` until a future approved migration sprint.

---

## Entry model

One JSON file per rewrite template under `rewrite-corpus/rewrites/`.

| Field | Role |
|-------|------|
| `rewrite_id` | Stable slug; suffix of `knowledge_id` |
| `legacy_template_id` | Bridge to `rewrite-templates.json` |
| `rewrite_purpose` | Why this rewrite guidance exists |
| `rewrite_status` | `draft` · `validated` · `production` · `deprecated` |
| `rewrite_version` | Semver contract version |
| `rewrite_strategy_type` | `qualify` · `remove` · `disclose` · `cite_evidence` |
| `rewrite_guidance` | TRIGGER / ACTION / CHECK reviewer guidance |
| `measurable_criteria` | `must_remove_terms`, `must_include_concepts` (eval alignment) |
| `benchmark_refs` | benchmark-v3 `case_id` references |
| `case_refs` | Future Case Corpus `case:…` references (empty until 5D) |
| `expected_evidence_type` | Evidence classification until Evidence Corpus (5C) |
| `evidence_requirement` | `none` · `recommended` · `required` |
| `linkage` | `regulations`, `rules`, `skills` (no `linkage.evidence` until 5C) |

### Independent disclosure rewrites

Disclosure templates (`disclose-*`) are **standalone rewrite strategies** — not dependent on Localization or other skill modules:

```json
{
  "rewrite_linkage_scope": "independent",
  "rewrite_independence_rationale": "Standalone disclosure rewrite guidance; not bound to a Skill Corpus entry."
}
```

### Evidence (pre-5C)

Do **not** author `linkage.evidence` or planned `evidence:…` IDs before Evidence Corpus exists. Use:

- `evidence_requirement` — governance field
- `expected_evidence_type` — `none` · `certification` · `lab_report` · `substantiation_general` · `test_method`

Formal `linkage.evidence` begins in Sprint 5C.

---

## Linkage rules

| Target | Validation |
|--------|------------|
| `linkage.regulations` | Error if unknown (required for active entries unless `regulation_scope: independent`) |
| `linkage.rules` | Error if unknown (required for active entries) |
| `linkage.skills` | Error if unknown; not required when `rewrite_linkage_scope: independent` |
| `benchmark_refs` | Error if unknown benchmark-v3 `case_id` |
| `case_refs` | Must use `case:` prefix; validated when Case Corpus exists |
| Skill ↔ Rewrite symmetry | **Warning** in 5B-2 (error after corpus maturity) |

---

## Commands

```bash
pnpm knowledge:build-rewrite-corpus-index
pnpm knowledge:validate-rewrite-corpus
pnpm knowledge:rewrite-corpus-coverage-report
pnpm knowledge:rewrite-corpus-dashboard
pnpm knowledge:rewrite-corpus-drift-report
pnpm knowledge:platform-dashboard
```

---

## Authoring checklist

- [ ] `knowledge_id` matches `rewrite:{rewrite_id}`
- [ ] `legacy_template_id` matches `rewrite-templates.json` entry
- [ ] `rewrite_strategy_type` matches legacy `strategy`
- [ ] `measurable_criteria` aligned with legacy template
- [ ] `benchmark_refs` includes representative benchmark-v3 cases
- [ ] `cite_evidence` entries have `expected_evidence_type` + `evidence_requirement: required`
- [ ] No generated rewrite text or LLM instructions in entry
- [ ] `rewrite-templates.json` unchanged unless explicitly approved
