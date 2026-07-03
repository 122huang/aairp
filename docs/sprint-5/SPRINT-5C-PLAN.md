# Sprint 5C — Evidence Corpus Plugin

**Status:** Done  
**Theme:** Evidence Corpus as Knowledge Corpus — requirements, types, and validation criteria, not a document repository  
**Master roadmap:** [KNOWLEDGE-ROADMAP-v1.0.md](../knowledge/KNOWLEDGE-ROADMAP-v1.0.md)  
**Precedent:** [SPRINT-5B-1-PLAN.md](./SPRINT-5B-1-PLAN.md) · [SPRINT-5B-2-PLAN.md](./SPRINT-5B-2-PLAN.md) · [REWRITE-CORPUS.md](../knowledge/REWRITE-CORPUS.md)

---

## Constraints (non-negotiable)

| Constraint | Implication |
|------------|-------------|
| Runtime pipeline frozen | No changes to `Rule → Playbook → LLM → Decision` |
| No document repository in git | No PDFs, lab reports, or cert scans in corpus files — **metadata and validation criteria only** |
| Knowledge Platform Core frozen | Extend via **new plugin**; do not fork governance |
| No production runtime loading | Git + governance only until future approved import/KOS sprint |
| Preserve shared models | `KnowledgeEntry` envelope + `KnowledgeLinkage` — no parallel evidence DB |
| 3 corpora frozen for consumers | Regulation / Skill / Rewrite eval and runtime paths **unchanged** unless linkage validation upgrades only |

---

## 1. Evidence Corpus role in the Knowledge Graph

### 1.1 What Evidence Corpus is (and is not)

| Evidence Corpus **is** | Evidence Corpus **is not** |
|------------------------|------------------------------|
| Canonical knowledge of **what substantiation is required** for a claim class | A document management system or file store |
| **Evidence type** definitions with **validation criteria** reviewers apply | Raw evidence blobs, PII, or product-specific uploads in git |
| Linkage hub connecting Regulation → Rule → Skill → Rewrite substantiation semantics | Runtime substantiation engine or auto-verification service |
| Governance surface (KQS, freshness, expiry, coverage) | Replacement for manual reviewer evidence checks in live review |

**Core question answered:** *What evidence is required, of what type, validated how, and linked to which regulatory and review context?*

### 1.2 Position in the graph (post 5B-2)

```
                    ┌─────────────────┐
                    │   Regulation    │
                    │  (grounds law)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │   Rule   │   │ Evidence │   │ (future) │
        │ (binds)  │◀──│ (types & │──▶│   Case   │
        └────┬─────┘   │ criteria)│   └──────────┘
             │         └────┬─────┘
             ▼              │
        ┌──────────┐        │
        │   Skill  │────────┘
        └────┬─────┘
             ▼
        ┌──────────┐
        │ Rewrite  │  (cite_evidence strategy)
        └────┬─────┘
             ▼
        Benchmark / Eval
```

Evidence sits **orthogonal** to the Rule → Skill → Rewrite vertical chain — it **qualifies** when substantiation is needed and **how** it is validated, without owning regulatory decisions (Rules) or review capability (Skills).

### 1.3 Linkage chain (updated semantics)

```
Regulation ──requires──▶ Evidence Type Knowledge
       │                        │
       ▼                        ▼
     Rule ──substantiation──▶ Skill ──▶ Rewrite (cite_evidence)
       │                        │
       └──────────▶ Benchmark / Case (future attachment refs)
```

| Hop | Mechanism today | After 5C |
|-----|-----------------|----------|
| Regulation → Evidence | `related_evidence_ids: []` (blocked) | `related_evidence_ids` / `linkage.evidence` → `evidence:{id}` |
| Rule → Evidence | Implicit via claim type | `linkage.evidence` on evidence entry + reverse refs |
| Skill → Evidence | `evidence_requirement` field only | `linkage.evidence` + type alignment |
| Rewrite → Evidence | `expected_evidence_type` enum only | `linkage.evidence` resolves enum → evidence entry |
| Evidence → Case | N/A | `case_refs` / external KOS pointer (5D+) |

### 1.4 Conceptual unit: Evidence Requirement Entry

Unlike Skill (review capability) or Rewrite (revision guidance), an Evidence entry defines a **substantiation contract**:

| Dimension | Skill | Rewrite | Evidence |
|-----------|-------|---------|----------|
| Question | *How to review?* | *How to revise?* | *What substantiation applies and how to validate it?* |
| Execution | Reviewer checkpoints | Measurable rewrite criteria | Validation checklist |
| Binding | Non-decision | Non-generation | Non-storage |

**5C pilot granularity:** One JSON per **evidence requirement entry** — typically scoped by `evidence_type` + jurisdiction and/or claim class (e.g. `sg-certification-mark`, `apac-lab-report-performance`).

---

## 2. EvidenceEntry schema proposal

### 2.1 File layout

```
docs/knowledge/evidence-corpus/
  README.md
  evidence-types.json              # taxonomy (aligned with rewrite expected_evidence_type)
  schemas/
    evidence-corpus-entry.schema.json
  evidence/
    sg-certification-mark.json
    apac-substantiation-health-claim.json
    ...                            # pilot ~20 entries
  evidence-corpus.manifest.json    # generated
```

### 2.2 Envelope (shared — unchanged)

`knowledge_id`, `corpus_type`, `owner`, `owner_type`, `last_reviewed`, `review_status`, `tags`, optional `confidence_level`.

### 2.3 Evidence-specific payload

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `evidence_id` | string slug | ✓ | Stable key; suffix of `knowledge_id` |
| `evidence_purpose` | string | ✓ | Why this evidence requirement exists |
| `evidence_status` | enum | ✓ | `draft` · `validated` · `production` · `deprecated` |
| `evidence_version` | semver | ✓ | Contract version |
| `evidence_type` | enum | ✓ | `certification` · `lab_report` · `substantiation_general` · `test_method` · `patent` · `award` |
| `summary` | string | ✓ | Plain-language substantiation requirement |
| `review_guidance` | string | ✓ | TRIGGER / ACTION / CHECK / ESCALATE IF for reviewers |
| `validation_criteria` | object | ✓ | Declarative checks (see below) — **not** automated execution |
| `applicability` | object | ✓ | Countries, claim types, categories, modalities |
| `linkage` | KnowledgeLinkage subset | ✓ | Cross-corpus links |
| `document_ref_spec` | object | optional | **Locator pattern** — not a stored document |
| `validity_window` | object | optional | Type-level validity expectations |
| `requirement_level` | enum | ✓ | `required` · `recommended` · `optional` — binding strength |
| `legacy_expected_evidence_type` | string | optional | Bridge to Rewrite Corpus `expected_evidence_type` |

**`validation_criteria`** (declarative reviewer checklist)

```json
{
  "checks": [
    "Confirm issuer is recognized certification body for target market",
    "Verify certificate scope covers advertised product SKU or category",
    "Confirm certificate is legible at published ad resolution",
    "Check certificate expiry date against campaign flight dates"
  ],
  "reject_if": [
    "Certificate expired at time of review",
    "Scope does not cover advertised product"
  ],
  "acceptable_issuers": ["HSA", "SIRIM", "TISI"],
  "scoring_notes": "Governance metadata only — not runtime scoring logic."
}
```

**`document_ref_spec`** (metadata locator — NOT file storage)

```json
{
  "ref_kind": "certification_record",
  "id_format": "{issuer}-{cert_number}",
  "storage_system": "KOS | compliance_dms | external",
  "example": "HSA-CP-2024-00123",
  "notes": "Actual documents live outside git; this field documents how refs are formed."
}
```

**`applicability`**

```json
{
  "countries": ["SG", "MY", "TH"],
  "claim_types": ["certification-claim", "performance-claim"],
  "categories": ["sa.*", "electronics"],
  "modalities": ["text", "image"]
}
```

**`validity_window`** (type-level; distinct from `last_reviewed` freshness)

```json
{
  "typical_validity_months": 12,
  "renewal_review_trigger": "annual",
  "notes": "Reviewer must confirm instance validity; corpus defines expectation."
}
```

**`linkage`** (authoritative cross-corpus)

| Key | Content |
|-----|---------|
| `linkage.regulations` | ≥1 `regulation:{id}` grounding substantiation obligation |
| `linkage.rules` | Demo rule IDs requiring substantiation |
| `linkage.skills` | `skill:{id}` entries that require this evidence type |
| `linkage.rewrites` | `rewrite:{id}` entries (especially `cite_evidence`) |
| `linkage.cases` | Future `case:{id}` with evidence attachments (5D) |

**Reference fields (Case Corpus prep — mirror Rewrite pattern)**

| Field | Purpose |
|-------|---------|
| `benchmark_refs` | Optional — benchmark cases exercising evidence-dependent claims |
| `case_refs` | Future Case Corpus `case:…` IDs |

### 2.4 Explicitly excluded from EvidenceEntry

| Excluded | Reason |
|----------|--------|
| Base64 / binary document content | Not a document repository |
| LLM verification prompts | No LLM changes in 5C |
| Auto-pass / auto-fail logic | Rules own decisions; evidence defines criteria |
| Product SKU-specific cert instances (pilot) | Belongs in KOS/Case layer later |
| `linkage.evidence` self-reference | N/A |

---

## 3. Relationship with Regulation / Rule / Skill / Rewrite

### 3.1 Regulation → Evidence

| Regulation role | Evidence role |
|-----------------|---------------|
| Declares **when** substantiation is legally required (`evidence:required` tag, claim category) | Defines **what** satisfies that obligation |
| `related_evidence_ids` currently **blocked** (validator error if non-empty) | 5C **unblocks** with validation against Evidence Corpus |

**5C migration:** For regulations tagged `evidence:required` in high-priority categories (Health, Performance, Certification, Comparative), author 1–2 evidence entry links per regulation entry (pilot subset — not all 75 at once).

### 3.2 Rule → Evidence

| Direction | Semantics |
|-----------|-----------|
| Evidence → Rule | Evidence entry `linkage.rules` lists rules whose substantiation this entry satisfies |
| Rule → Evidence (implicit) | Validator warns if `demo-apac-sa-certification-evidence` rule has no evidence entry referencing it |

Rules remain **decision owners**; evidence entries describe substantiation context for reviewer guidance only.

### 3.3 Skill → Evidence

| Skill entry today | Evidence linkage after 5C |
|-----------------|---------------------------|
| `evidence_requirement: required` | Must link ≥1 `evidence:{id}` via `linkage.evidence` (new field on skill entry — **optional in 5C-1**, warn-only initially) |
| `certification-claim-review`, `performance-claim-review`, `health-claim-review` | Primary pilot skill targets |

**Bidirectional integrity (warn in 5C, error after Case Corpus):**

- If `skill:certification-claim-review` links `evidence:sg-certification-mark`, that evidence entry must link back via `linkage.skills`.

### 3.4 Rewrite → Evidence

| Rewrite entry today | Evidence linkage after 5C |
|-------------------|---------------------------|
| `expected_evidence_type: certification` on `rewrite:cite-evidence` | Resolves to ≥1 evidence entry with matching `evidence_type` |
| `evidence_requirement: required` | Evidence entries with `requirement_level: required` |

**Resolution rule:** `expected_evidence_type` enum values must map to ≥1 production evidence entry of that `evidence_type` (corpus-level coverage gate).

### 3.5 Cross-corpus summary matrix

| Corpus | Links to Evidence | Links from Evidence |
|--------|-------------------|---------------------|
| Regulation | `related_evidence_ids` → `evidence:{id}` | `linkage.regulations` |
| Rule | (indirect via regulation/skill) | `linkage.rules` |
| Skill | `linkage.evidence` (new, phased) | `linkage.skills` |
| Rewrite | `linkage.evidence` (new, phased) | `linkage.rewrites` |
| Case (5D) | `linkage.evidence` on case | `linkage.cases` on evidence |

---

## 4. Evidence lifecycle

### 4.1 Status model (`evidence_status`)

Mirror Skill / Rewrite corpora:

| Status | Meaning | Linkage requirements |
|--------|---------|---------------------|
| `draft` | Work in progress | Recommended |
| `validated` | Reviewed, not released | Full linkage required |
| `production` | Active knowledge asset | Full linkage required |
| `deprecated` | Superseded; audit retention | N/A |

Plus shared `review_status`: `draft` · `legal_reviewed` · `deprecated`.

### 4.2 Ownership

| Owner type | Accountability |
|------------|----------------|
| `compliance` | Evidence type taxonomy, issuer lists, operational criteria |
| `legal` | Binding substantiation for claim-class entries |
| `knowledge_eng` | Corpus health, linkage, pilot authoring |

Per roadmap: **Compliance + Legal** co-ownership; legal review for binding substantiation entries.

### 4.3 Freshness dimensions (two layers)

| Layer | Field | Governance |
|-------|-------|------------|
| **Knowledge freshness** | `last_reviewed` | Platform green/yellow/red bands (180/365 days) |
| **Validity expectation** | `validity_window.typical_validity_months` | KQS dimension; warn if criteria incomplete |
| **Instance expiry** | Not in corpus | Reviewer checks per `validation_criteria`; Case/KOS in future |

**Deprecated handling:** `evidence_status: deprecated` excluded from coverage numerators; retained for audit and supersession chains (`tags: supersedes:evidence:…`).

### 4.4 Lifecycle flow

```
Author evidence requirement (draft)
    → Legal/compliance review (validated)
    → Link regulation + rule + skill/rewrite
    → Promote to production
    → Periodic re-review (last_reviewed) / validity window update
    → Deprecate when superseded
```

---

## 5. Validation rules

### 5.1 Structure validation (errors)

| Code | Condition |
|------|-----------|
| `invalid_entry` | Schema / normalize failure |
| `duplicate_knowledge_id` | Duplicate `evidence_id` |
| `missing_regulation_linkage` | Active entry without `linkage.regulations` (unless `regulation_scope: independent`) |
| `missing_rule_linkage` | Active entry without `linkage.rules` |
| `invalid_regulation_link` | Unknown `regulation:{id}` |
| `invalid_rule_link` | Unknown demo rule ID |
| `invalid_skill_link` | Unknown `skill:{id}` |
| `invalid_rewrite_link` | Unknown `rewrite:{id}` |
| `invalid_benchmark_ref` | Unknown benchmark-v3 `case_id` |
| `invalid_case_ref` | `case_refs` without `case:` prefix or unknown (when Case Corpus exists) |
| `cite_evidence_type_gap` | `evidence_type` not covered by any production entry when rewrite `expected_evidence_type` requires it (corpus-level) |

### 5.2 Governance validation (warnings)

| Code | Condition |
|------|-----------|
| `missing_review_guidance` | Empty `review_guidance` |
| `missing_confidence` | No confidence classification |
| `incomplete_validation_criteria` | `< 2` checks in `validation_criteria.checks` |
| `missing_document_ref_spec` | `requirement_level: required` without `document_ref_spec` |
| `stale_knowledge` | `last_reviewed` > 365 days |
| `orphan_entry` | No outbound linkage |
| `asymmetric_skill_evidence_link` | Skill ↔ evidence one-way (warn in 5C) |
| `asymmetric_rewrite_evidence_link` | Rewrite ↔ evidence one-way (warn in 5C) |
| `regulation_evidence_unlinked` | Regulation tagged `evidence:required` but no evidence entry links back (coverage report) |

### 5.3 Regulation Corpus validator upgrade (5C side effect)

| Today | After 5C |
|-------|----------|
| `related_evidence_ids` non-empty → **error** | Validate IDs exist in Evidence Corpus |
| Prefix must be `evidence:` | Unchanged |

### 5.4 Rewrite / Skill validator upgrades (phased)

| Phase | Change |
|-------|--------|
| 5C | Rewrite `expected_evidence_type` coverage report — each enum value has ≥1 production evidence entry |
| 5C.1 | Optional `linkage.evidence` on rewrite/skill entries; warn if missing for `cite_evidence` / `evidence_requirement: required` |
| 5D+ | Promote asymmetric linkage warnings to errors |

### 5.5 KQS dimensions (evidence-specific)

| Dimension | Measures |
|-----------|----------|
| `evidence_purpose` | Purpose completeness |
| `validation_criteria` | Checks and reject_if present |
| `document_ref_spec` | Locator spec for required-level entries |
| `regulation_linkage` | ≥1 regulation linked |
| `rule_linkage` | ≥1 rule linked |
| `skill_rewrite_linkage` | ≥1 skill or rewrite linked |
| `applicability` | Countries + claim types declared |
| + shared | summary, review_guidance, confidence, evidence classification |

### 5.6 Corpus-specific gate (roadmap §8.3)

> Evidence: Document ref locatable; expiry date where applicable

Interpreted for 5C as: `document_ref_spec` present and well-formed; `validity_window` or expiry checks in `validation_criteria` for `certification` / `lab_report` types.

---

## 6. Implementation plan

### 6.1 Pilot scope (~20 entries)

Prioritize evidence types backing existing Skill + Rewrite + Regulation chain:

| Pilot cluster | `evidence_type` | Example `evidence_id` | Upstream links |
|---------------|-----------------|----------------------|----------------|
| Certification marks | `certification` | `sg-hsa-certification-mark`, `my-sirim-certification` | `rewrite:cite-evidence`, `skill:certification-claim-review`, certification regulations |
| Lab / test reports | `lab_report` | `apac-performance-lab-report` | `skill:performance-claim-review`, performance regulations |
| Test methods | `test_method` | `apac-capacity-test-method` | `rewrite:qualify-performance`, capacity/performance rules |
| Health substantiation | `substantiation_general` | `apac-health-claim-substantiation` | `skill:health-claim-review`, health regulations |
| Comparative substantiation | `substantiation_general` | `apac-comparative-test-substantiation` | `skill:comparative-claim-review` |
| Superlative / efficacy | `substantiation_general` | `apac-efficacy-substantiation` | `skill:superlative-claim-review`, `rewrite:qualify-efficacy` |
| Patent / award (optional pilot) | `patent` / `award` | `apac-patent-reference` | `demo-apac-sa-patent-claim` rule |

**Out of pilot:** Product-instance evidence, disclosure-type evidence (`evidence:none` regulations), per-SKU cert records.

### 6.2 Epic breakdown

| Epic | Scope | Outcome |
|------|-------|---------|
| **E1** | Schema & taxonomy | `evidence-corpus-entry.schema.json`, `evidence-types.json`, `EVIDENCE-CORPUS.md` |
| **E2** | ~20 pilot evidence entries | Authored JSON with full linkage |
| **E3** | Loader + adapter | `evidence-corpus.ts`, `evidence-entry.adapter.ts` |
| **E4** | Platform plugin | `evidence-corpus.plugin.ts` + register (4th corpus) |
| **E5** | Governance facades | Validator, coverage, KQS, index, dashboard, CLI |
| **E6** | Tests | Loader, governance, platform snapshot (4 corpora) |
| **E7** | Docs | Authoring standard §2.x, roadmap KPI, sprint README |
| **E8** | Cross-corpus upgrades | Regulation `related_evidence_ids` unblock; rewrite type coverage report |
| **E9** | Regulation pilot linkage | Link ~15–25 `evidence:required` regulations to pilot evidence entries (subset) |
| **E10** | Drift / coverage reports | `evidence:required` regulations without evidence; `expected_evidence_type` resolution |

**Explicitly out of scope for 5C:**

- Document upload, OCR, or storage pipelines
- Runtime / LLM substantiation verification
- Case Corpus plugin (5D)
- KOS evidence import (future)
- Full regulation corpus evidence backfill (75 entries) — pilot subset only
- Skill/Rewrite `linkage.evidence` field migration (phased 5C.1 unless approved in 5C)

### 6.3 Files to create (planned)

```
docs/knowledge/evidence-corpus/**
docs/knowledge/EVIDENCE-CORPUS.md
docs/sprint-5/SPRINT-5C-PLAN.md

packages/application/src/knowledge/
  evidence-corpus.ts
  corpus/evidence-entry.adapter.ts
  corpus/evidence-corpus.plugin.ts
  evidence-corpus-{validator,coverage,kqs,index,dashboard,drift}.ts
  run-*-evidence-corpus-*.ts
  evidence-corpus.spec.ts
  evidence-corpus-governance.spec.ts
```

### 6.4 Files to modify (minimal)

| File | Change |
|------|--------|
| `platform/knowledge-platform.ts` | Register evidence plugin |
| `corpus/regulation-corpus.plugin.ts` | Allow + validate `related_evidence_ids` |
| `package.json` (root + application) | `knowledge:*-evidence-corpus-*` scripts |
| `KNOWLEDGE-AUTHORING-STANDARD.md` | Evidence Corpus section |
| `KNOWLEDGE-ROADMAP-v1.0.md` | Evidence row → plugin registered (post-implementation) |

### 6.5 Files explicitly NOT modified

| File | Reason |
|------|--------|
| `demo/rules.demo.json` | Runtime frozen |
| `review/**` | Runtime frozen |
| `benchmark-v3-evaluator` | No eval behavior change in 5C |
| `rewrite-templates.json` | Frozen consumer |

### 6.6 Commands (planned)

```bash
pnpm knowledge:build-evidence-corpus-index
pnpm knowledge:validate-evidence-corpus
pnpm knowledge:evidence-corpus-coverage-report
pnpm knowledge:evidence-corpus-dashboard
pnpm knowledge:evidence-corpus-drift-report
pnpm knowledge:platform-dashboard          # 4 corpora
```

### 6.7 Acceptance criteria

- [ ] ~20 evidence entries with valid envelope + payload
- [ ] No document binary content in git corpus
- [ ] Active entries link to ≥1 regulation and ≥1 rule each
- [ ] Each `evidence_type` used by Rewrite Corpus has ≥1 production entry
- [ ] Regulation validator accepts `related_evidence_ids` for pilot regulations
- [ ] Plugin registered; platform dashboard shows 4 corpora
- [ ] Validator: **0 errors** on pilot entries
- [ ] `rewrite:cite-evidence` resolvable to certification evidence entry
- [ ] Zero runtime / review / LLM changes

---

## 7. Open questions for review

*Resolved at implementation — see §8.*

---

## 8. Review follow-up (approved 2026-07-01)

Sprint 5C **approved** with non-blocking recommendations documented in [EVIDENCE-GOVERNANCE.md](../knowledge/EVIDENCE-GOVERNANCE.md).

| # | Recommendation | Disposition |
|---|----------------|-------------|
| 1 | EvidenceType vs EvidenceRequirement future split | Documented §3 EVIDENCE-GOVERNANCE; no jurisdiction in `evidence_id` |
| 2 | Skill → Evidence error; Evidence → Skill warn | **Kept** — no bidirectional error until Case Corpus maturity |
| 3 | 20 entries / 26 regulation links; no 75 backfill | **Approved** — expansion priority: health → performance → comparative → certification |
| 4 | KQS vs coverage maturity | Documented §10; **KQS Gap Report** planned (not yet implemented) |
| 5 | EVIDENCE-GOVERNANCE.md | **Created** |
| 6 | Case Corpus linkage conventions | Documented §11; full design in [SPRINT-5D-PLAN.md](./SPRINT-5D-PLAN.md) |

**Next step:** Sprint 5D planning (Case Corpus as validation knowledge).

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-01 | Initial Sprint 5C plan — analysis only, no implementation |
| 2026-07-01 | Implementation complete; review follow-up §8 |
