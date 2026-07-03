# Sprint 5D — Case Corpus Plugin

**Status:** Implemented (Sprint 5D)  
**Theme:** Case Corpus as **validation and learning knowledge** — not a case archive  
**Master roadmap:** [KNOWLEDGE-ROADMAP-v1.0.md](../knowledge/KNOWLEDGE-ROADMAP-v1.0.md)  
**Precedent:** [SPRINT-5C-PLAN.md](./SPRINT-5C-PLAN.md) · [EVIDENCE-GOVERNANCE.md](../knowledge/EVIDENCE-GOVERNANCE.md)

---

## Constraints (non-negotiable)

| Constraint | Implication |
|------------|-------------|
| Runtime pipeline frozen | No changes to `Rule → Playbook → LLM → Decision` |
| No case archive in git | No full review payloads, ad blobs, or PII in corpus files |
| No automatic compliance decisions | Case knowledge informs eval and learning — does not auto-approve/reject live reviews |
| Knowledge Platform Core frozen | Extend via **new plugin**; do not fork governance |
| No production runtime loading | Git + governance only until future approved import |
| Evidence asymmetry preserved | Do not upgrade Skill ↔ Evidence to bidirectional error until Case maturity |

---

## 1. Case Corpus role in the Knowledge Graph

### 1.1 What Case Corpus is (and is not)

| Case Corpus **is** | Case Corpus **is not** |
|--------------------|------------------------|
| **Validation knowledge** — what ground truth applies and how to verify review outcomes | A dump of `case-library/` review JSON |
| **Learning feedback** — regression signals, promotion rationale, eval expectations | Runtime case storage or KOS replacement |
| Linkage hub connecting Benchmark ↔ Skill ↔ Rewrite ↔ Evidence | Duplicate of benchmark-v3 case fixtures |
| Governance surface for verification rate and promotion queue | Automatic compliance decision engine |

**Core question answered:** *What is the verified expected outcome for this ad scenario, and how does it validate our knowledge assets?*

### 1.2 Position in the graph (post 5C)

```
Regulation
    ↓
Rule
    ↓
Skill  ←──── Case evaluates Skill
    ↓
Rewrite ←──── Case verifies Rewrite
    ↑
Evidence ←── Case validates against Evidence
```

**Vertical chain** (Regulation → Rule → Skill → Rewrite) defines review capability.  
**Case** sits as **validation feedback** orthogonal to authoring — it tests whether knowledge assets produce correct outcomes.

### 1.3 Relationship to existing artifacts

| Artifact | Role | Case Corpus relationship |
|----------|------|--------------------------|
| **benchmark-v3.json** | Eval specification (92 cases) | Case entries **reference** `benchmark_ref` (`case_id`); do not duplicate fixture text |
| **case-library/** | Operational review snapshots | Case entries **reference** `source_case_id`; do not copy payloads |
| **benchmark-promotion-queue.json** | Staging for promotion | Case `verification_status` feeds queue; corpus owns knowledge metadata |
| **Eval pipeline** | Measures decision/pattern/rewrite | Case `ground_truth_spec` aligns with eval dimensions |

**Principle:** One logical scenario may exist in three layers — benchmark fixture (eval), case-library blob (ops), Case Corpus entry (knowledge). The corpus holds **knowledge about the scenario**, not the scenario itself.

---

## 2. CaseEntry schema proposal

### 2.1 File layout

```
docs/knowledge/case-corpus/
  README.md
  case-taxonomy.json              # validation dimensions, claim types
  schemas/
    case-corpus-entry.schema.json
  cases/
    health-reject-cure-sg.json
    ...
  case-corpus.manifest.json       # generated
```

### 2.2 Envelope (shared — unchanged)

`knowledge_id`, `corpus_type`, `owner`, `owner_type`, `last_reviewed`, `review_status`, `tags`, optional `confidence_level`.

### 2.3 Case-specific payload

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `case_id` | string slug | ✓ | Stable key; suffix of `knowledge_id` — **no jurisdiction in slug** |
| `case_purpose` | string | ✓ | Why this validation case exists |
| `case_status` | enum | ✓ | `draft` · `candidate` · `verified` · `regression` · `deprecated` |
| `case_version` | semver | ✓ | Knowledge contract version |
| `verification_status` | enum | ✓ | `unverified` · `human_verified` · `legal_verified` · `rejected` |
| `summary` | string | ✓ | Plain-language scenario description |
| `review_guidance` | string | ✓ | How reviewers / evaluators use this case |
| `scenario_spec` | object | ✓ | **Metadata only** — claim type, modality, risk class (not full ad text) |
| `ground_truth_spec` | object | ✓ | Expected outcomes for eval dimensions |
| `linkage` | KnowledgeLinkage subset | ✓ | Cross-corpus links |
| `benchmark_ref` | string | optional | benchmark-v3 `case_id` (e.g. `AF-002`) |
| `source_case_id` | string | optional | case-library or KOS reference — locator only |
| `regression_notes` | string | optional | Why case is in regression set |
| `promotion_rationale` | string | optional | Why candidate should promote to benchmark |

**`scenario_spec`** (no ad content)

```json
{
  "claim_types": ["health-claim"],
  "countries": ["SG"],
  "categories": ["health.supplement"],
  "modalities": ["text"],
  "risk_class": "HIGH",
  "signal_terms": ["cure", "clinically proven"],
  "fixture_ref": "benchmark:AF-002"
}
```

**`ground_truth_spec`** (aligns with benchmark-v3 eval dimensions)

```json
{
  "expected_decision": "REJECT",
  "expected_severity": "HIGH",
  "expected_action": "REJECT",
  "expected_skill": "skill:health-claim-review",
  "expected_pattern": "sa-health-implication",
  "expected_rule": "demo-sg-health-forbidden-claim",
  "expected_rewrite": {
    "rewrite_id": "rewrite:remove-health-claim",
    "strategy_type": "remove",
    "must_remove_terms": ["cure"],
    "must_include_concepts": []
  },
  "evidence_validation": {
    "evidence_id": "evidence:health-claim-substantiation",
    "expected_outcome": "reject_insufficient_substantiation"
  }
}
```

**Explicitly excluded:** Full `advertisement.content`, `matched_rules` payloads, embeddings, PII, binary assets.

### 2.4 Future split (analogous to Evidence)

| Concept | Field today | Future |
|---------|-------------|--------|
| Case scenario type | `scenario_spec.claim_types` | **CaseScenarioType** |
| Validation instance | `case_id` + `applicability` | **CaseValidation** per jurisdiction/claim |

Do not duplicate cases only because jurisdiction differs — one scenario type, multiple validation instances.

---

## 3. Relationships with existing corpora

### 3.1 Case ↔ Benchmark / Eval

| Direction | Semantics |
|-----------|-----------|
| Case → Benchmark | `benchmark_ref` links to benchmark-v3 `case_id` |
| Benchmark → Case | Drift report: benchmark cases without Case Corpus entry |
| Eval | `ground_truth_spec` mirrors eval dimensions; Case does not run eval |

**Eval loop:**

```
benchmark-v3 case → Case Corpus entry (knowledge)
    → eval run produces scores
    → regression failure → case_status: regression
    → fix Skill/Rewrite/Evidence → re-verify → verification_status: human_verified
```

### 3.2 Case ↔ Skill

| Direction | Semantics |
|-----------|-----------|
| Case → Skill | `linkage.skills` — which skill capability is under test |
| Skill → Case | `linkage.cases` (new, phased) — skills declare eval cases |

**Validation:** Case **evaluates** skill — did the skill module attribution and review guidance produce the expected outcome?

### 3.3 Case ↔ Rewrite

| Direction | Semantics |
|-----------|-----------|
| Case → Rewrite | `ground_truth_spec.expected_rewrite` + `linkage.rewrites` |
| Rewrite → Case | `case_refs` on rewrite entries (already reserved) |

**Validation:** Case **verifies** rewrite — do `measurable_criteria` hold for this scenario?

### 3.4 Case ↔ Evidence

| Direction | Semantics |
|-----------|-----------|
| Case → Evidence | `ground_truth_spec.evidence_validation` + `linkage.evidence` |
| Evidence → Case | `case_refs` on evidence entries (already reserved) |

**Validation:** Case **validates against** evidence requirement — was substantiation sufficient per `validation_criteria`?

### 3.5 Case ↔ Regulation / Rule

| Direction | Semantics |
|-----------|-----------|
| Case → Regulation | `linkage.regulations` — legal grounding for scenario |
| Case → Rule | `linkage.rules` + `ground_truth_spec.expected_rule` |

---

## 4. Verified / unverified lifecycle

### 4.1 Status models

**`case_status`** (corpus lifecycle)

| Status | Meaning |
|--------|---------|
| `draft` | Authored, not in eval set |
| `candidate` | Eligible for benchmark promotion |
| `verified` | Accepted validation knowledge |
| `regression` | Eval failure — requires knowledge fix |
| `deprecated` | Superseded; retained for audit |

**`verification_status`** (human/legal gate)

| Status | Meaning |
|--------|---------|
| `unverified` | Auto-generated or imported; not trusted for strict regression |
| `human_verified` | Compliance / reviewer confirmed ground truth |
| `legal_verified` | Legal sign-off for promotion to core benchmark |
| `rejected` | Ground truth disputed; exclude from promotion |

### 4.2 Promotion flow

```
case-library / pilot capture
    → Case Corpus draft (source_case_id)
    → human_verified
    → candidate + promotion_rationale
    → legal_verified (if required)
    → benchmark-promotion-queue
    → benchmark-v3 inclusion (separate eval artifact)
```

Case Corpus **records promotion knowledge**; benchmark JSON update remains a separate governed step.

### 4.3 Regression feedback loop

```
Eval failure on benchmark_ref
    → case_status: regression
    → regression_notes documents failure dimension
    → triage: Skill / Rewrite / Evidence / Rule knowledge gap?
    → fix upstream corpus entry
    → re-run eval
    → verification_status refresh → case_status: verified
```

**No automatic fixes.** Case Corpus surfaces **where** knowledge failed — humans update Skill/Rewrite/Evidence.

---

## 5. Validation rules

### 5.1 Structure validation (errors)

| Code | Condition |
|------|-----------|
| `invalid_entry` | Schema / normalize failure |
| `duplicate_knowledge_id` | Duplicate `case_id` |
| `missing_ground_truth` | Active case without `ground_truth_spec` |
| `missing_scenario_spec` | Active case without `scenario_spec` |
| `invalid_benchmark_ref` | Unknown benchmark-v3 `case_id` |
| `invalid_regulation_link` | Unknown `regulation:{id}` |
| `invalid_skill_link` | Unknown `skill:{id}` |
| `invalid_rewrite_link` | Unknown `rewrite:{id}` |
| `invalid_evidence_link` | Unknown `evidence:{id}` |
| `invalid_rule_link` | Unknown demo rule ID |
| `ground_truth_skill_mismatch` | `expected_skill` not in `linkage.skills` |

### 5.2 Governance validation (warnings)

| Code | Condition |
|------|-----------|
| `unverified_production_case` | `case_status: verified` with `verification_status: unverified` |
| `missing_benchmark_ref` | Verified case without benchmark link |
| `orphan_case` | No corpus linkage |
| `stale_knowledge` | `last_reviewed` > 365 days |
| `asymmetric_rewrite_case_link` | Rewrite `case_refs` one-way |
| `benchmark_without_case_entry` | benchmark-v3 case_id with no Case Corpus entry (coverage report) |

### 5.3 Cross-corpus upgrades (phased)

| Phase | Change |
|-------|--------|
| 5D | Validate `case_refs` on Rewrite / Evidence entries |
| 5D | Skill `linkage.cases` optional; warn if skill has no eval cases |
| 5D.1 | Promote asymmetric Case ↔ Rewrite to error for verified cases |
| Post-5D | Consider Skill ↔ Evidence bidirectional error (only after Case maturity) |

---

## 6. KQS and coverage (dual score)

Mirror Evidence governance — separate **asset quality** from **coverage maturity**.

### 6.1 Asset quality (KQS dimensions)

| Dimension | Measures |
|-----------|----------|
| `case_purpose` | Purpose completeness |
| `ground_truth_spec` | Eval dimension coverage |
| `scenario_spec` | Scenario metadata completeness |
| `verification_status` | Human/legal verification |
| `benchmark_linkage` | `benchmark_ref` present |
| `skill_linkage` | Skill linked |
| + shared | summary, review_guidance, confidence |

### 6.2 Coverage maturity (gap report)

| Section | Metrics |
|---------|---------|
| **Benchmark coverage** | benchmark-v3 cases with Case Corpus entry / total |
| **Verification rate** | `human_verified` + `legal_verified` / production cases |
| **Skill eval coverage** | Skills with ≥1 linked case / total skills |
| **Rewrite verification** | Rewrites with ≥1 verifying case |
| **Evidence validation** | Evidence entries with ≥1 validating case |
| **Regression queue** | `case_status: regression` count and age |

---

## 7. Implementation plan (no code in planning phase)

### 7.1 Pilot scope

Start with **benchmark-aligned pilot** — not full case-library import.

| Pilot cluster | Source | Target count |
|---------------|--------|-------------|
| Health reject / warn | AF-002, PC-008, sg-health-* | ~8 |
| Performance / capacity | AF-004, AF-005, PC-007 | ~6 |
| Comparative | AF-003, AF-006, PC-012 | ~5 |
| Certification / evidence | AF-009, AF-010, RC18-004 | ~5 |
| Disclosure (independent) | AF-001, disclose-* | ~4 |

**~25–30 pilot Case Corpus entries** referencing existing benchmark `case_id`s.

**Out of pilot:** Full 92-case backfill, case-library bulk import, embedding metadata, auto-promotion to benchmark.

### 7.2 Epic breakdown

| Epic | Scope | Outcome |
|------|-------|---------|
| **E1** | Schema, taxonomy, `CASE-CORPUS.md` | Entry contract |
| **E2** | ~25 pilot case entries | Benchmark-linked validation knowledge |
| **E3** | Loader, adapter, plugin | 5th platform corpus |
| **E4** | Governance facades | Validator, KQS, gap report, index, dashboard, drift |
| **E5** | Cross-corpus upgrades | `case_refs` validation on Rewrite/Evidence; skill `linkage.cases` |
| **E6** | Tests + docs | Authoring standard §Case; roadmap update |
| **E7** | Promotion bridge | Read-only integration with `benchmark-promotion-queue.json` |
| **E8** | Regression report | Eval failure → case_status workflow (governance only) |

**Explicitly out of scope:**

- Runtime review pipeline changes
- case-library JSON migration to git
- Automatic benchmark-v3 rewrites
- KOS case import
- Skill ↔ Evidence bidirectional error upgrade

### 7.3 Files to create (planned)

```
docs/knowledge/case-corpus/**
docs/knowledge/CASE-CORPUS.md
docs/sprint-5/SPRINT-5D-PLAN.md

packages/application/src/knowledge/
  case-corpus.ts
  corpus/case-entry.adapter.ts
  corpus/case-corpus.plugin.ts
  case-corpus-{validator,coverage,kqs,index,dashboard,drift,gap}.ts
  run-*-case-corpus-*.ts
  case-corpus.spec.ts
```

### 7.4 Acceptance criteria

- [x] ~25 pilot entries with `benchmark_ref` and `ground_truth_spec` (28 delivered)
- [x] No ad content blobs in corpus JSON
- [x] Verified cases link to ≥1 skill and ≥1 rule
- [x] Plugin registered; platform dashboard shows 5 corpora
- [x] Validator: 0 errors on pilot
- [x] Gap report: benchmark coverage % separate from KQS
- [x] Rewrite/Evidence `case_refs` validate against Case Corpus
- [x] Zero runtime changes

---

## 8. Review disposition (2026-07-01)

**Status:** APPROVED with adjustments — implemented per decisions below.

| # | Decision | Disposition |
|---|----------|-------------|
| 1 | One CaseEntry per benchmark `case_id`; no CaseFamily in 5D | **Accepted** — 28 pilot entries |
| 2 | Keep `verification_status` and `case_status` separate | **Accepted** |
| 3 | `verified` requires `human_verified`, not `legal_verified` for pilot | **Accepted** |
| 4 | Case-library bridge deferred to 5D.1 — locator metadata only | **Accepted** |
| 5 | `evidence_validation` required only for evidence-dependent cases | **Accepted** — plugin enforces |
| 6 | Promotion metadata only — no automation scripts | **Accepted** |
| 7 | Add declarative `case_result` block | **Accepted** |
| 8 | Pilot 25–30 entries across five claim clusters | **Accepted** — 28 entries |

### Open questions (resolved)

1. **Entry granularity:** One Case entry per benchmark `case_id` (recommended for pilot) vs grouped scenario families?
2. **`verification_status` gate:** Require `legal_verified` for `case_status: verified`, or allow `human_verified` for pilot?
3. **case-library bridge:** Reference-only (`source_case_id`) in pilot, or defer case-library linkage to 5D.1?
4. **Evidence validation block:** Mandatory `ground_truth_spec.evidence_validation` for evidence-dependent cases only, or all cases?
5. **Promotion automation:** Governance metadata only in 5D, or script-assisted benchmark-promotion-queue updates?

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-01 | Initial Sprint 5D plan — analysis only, no implementation |
| 2026-07-01 | Sprint 5D implemented — Case Corpus plugin, 28 pilot entries, governance facades |
