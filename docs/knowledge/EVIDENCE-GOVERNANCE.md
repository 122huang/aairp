# Evidence Corpus — Governance

**Applies to:** Evidence Corpus (`corpus_type: evidence`)  
**Related:** [EVIDENCE-CORPUS.md](./EVIDENCE-CORPUS.md) · [KNOWLEDGE-AUTHORING-STANDARD.md](./KNOWLEDGE-AUTHORING-STANDARD.md) · [SPRINT-5C-PLAN.md](../sprint-5/SPRINT-5C-PLAN.md)

---

## 1. Purpose

Evidence Corpus governs **substantiation knowledge** — what evidence is required, of what type, and how reviewers validate it. It does **not** store substantiation documents.

| Knowledge layer | Document layer |
|-----------------|----------------|
| Evidence requirement contracts | PDFs, lab reports, certificates |
| Validation criteria checklists | Uploaded files in KOS / compliance DMS |
| `document_ref_spec` locator patterns | Instance records (`HSA-CP-2024-00123`) |
| Cross-corpus linkage | Product-specific artifact blobs |

**Knowledge layer ≠ document repository.** Documents live outside git; the corpus defines how reviewers interpret and validate them.

---

## 2. Ownership

| Role | Accountability |
|------|----------------|
| **Compliance** (`owner_type: compliance`) | Evidence type taxonomy, issuer lists, operational validation criteria |
| **Legal** (`owner_type: legal`) | Binding substantiation requirements for claim classes |
| **Knowledge Engineering** (`owner_type: knowledge_eng`) | Corpus health, linkage integrity, platform reports |

Co-ownership applies to entries with `requirement_level: required` that ground regulatory obligations. Legal review (`review_status: legal_reviewed`) is required before `evidence_status: production`.

---

## 3. EvidenceType vs EvidenceRequirement (future split)

Sprint 5C uses a **single entry** with two fields that will split into separate concepts before corpus expansion:

| Today (5C) | Future EvidenceType | Future EvidenceRequirement |
|------------|---------------------|---------------------------|
| `evidence_type_key` | Reusable evidence category | — |
| `requirement_scope` | — | Jurisdiction / claim / regulatory context |
| `applicability.countries` | Optional type-level hint | Authoritative jurisdiction scope |
| `evidence_id` | Type slug (no jurisdiction) | Requirement slug (may reference type) |

### Design rule

**Do not duplicate entries only because jurisdiction differs.**

One EvidenceType can support many EvidenceRequirements:

```
clinical_substantiation          ← EvidenceType
    │
    ├── sg-health-claim          ← EvidenceRequirement (SG + health claim)
    ├── my-health-claim          ← EvidenceRequirement (MY + health claim)
    └── au-health-claim          ← EvidenceRequirement (AU + health claim)
```

Sprint 5C pilot entries combine type + scope in one JSON file. Expansion (post-5C) will introduce:

- `evidence-types.json` — canonical type definitions (validation patterns shared across markets)
- `evidence-requirements/` — jurisdiction- and claim-specific requirements referencing `evidence_type_key`

Until that split ships, use:

- `evidence_id` — **no jurisdiction** (e.g. `health-claim-substantiation`, not `sg-health-claim`)
- `applicability.countries` — market scope within a single requirement entry when piloting

---

## 4. Freshness review

| Layer | Field | Governance |
|-------|-------|------------|
| **Knowledge freshness** | `last_reviewed` | Platform bands: green ≤180d · yellow ≤365d · red >365d |
| **Entry lifecycle** | `evidence_status` | `draft` → `validated` → `production` → `deprecated` |
| **Review gate** | `review_status` | `legal_reviewed` required for production binding entries |

**Review cadence:**

- `requirement_level: required` + `evidence_status: production` — annual review minimum
- Regulation-linked entries — re-review when linked regulation `last_reviewed` changes
- Taxonomy changes (`evidence-types.json`) — trigger corpus-wide drift report

---

## 5. Deprecation rules

| Action | When |
|--------|------|
| Set `evidence_status: deprecated` | Superseded by new requirement or obsolete claim class |
| Retain entry in corpus | Audit trail; excluded from coverage numerators |
| Tag `supersedes:evidence:{id}` | Chain to replacement entry |
| Remove regulation `related_evidence_ids` | After all linked regulations updated to successor |
| Block new Skill → Evidence links | Validator error on deprecated target |

Deprecated entries remain readable. Do not delete without legal/compliance sign-off.

---

## 6. `validity_window` meaning

`validity_window` describes **type-level validity expectations**, not instance expiry stored in git.

| Field | Meaning |
|-------|---------|
| `typical_validity_months` | How long certification/lab evidence is typically valid |
| `renewal_review_trigger` | When reviewers should confirm renewal (e.g. `annual`) |
| `notes` | Governance metadata |

**Reviewer responsibility:** Confirm the **actual document instance** is valid at review time using `validation_criteria` and external records (KOS / DMS). The corpus does not track per-SKU certificate expiry.

---

## 7. Evidence requirement vs actual documents

| Concept | Corpus | External systems |
|---------|--------|------------------|
| **Evidence requirement** | What substantiation applies; validation checklist | — |
| **Evidence type** | Category (certification, lab_report, …) | — |
| **Document locator** | `document_ref_spec` pattern (`{issuer}-{cert_number}`) | Resolved instance |
| **Document artifact** | Not in git | KOS, compliance DMS, client upload |

Flow:

```
EvidenceEntry (knowledge)
    → reviewer applies validation_criteria
    → locates document via document_ref_spec pattern
    → confirms instance in external store
    → records outcome in review / case (future Case Corpus)
```

---

## 8. Skill ↔ Evidence linkage governance

| Direction | Severity | Rationale |
|-----------|----------|-----------|
| **Skill → Evidence** | **Error** (when `evidence_requirement: required`) | Skills are review entry points; must declare required substantiation |
| **Evidence → Skill** | **Warn** (asymmetric) | Evidence may support multiple skills; reverse ownership not required |

**Do not upgrade to bidirectional error validation until Case Corpus maturity (Sprint 5D+).**

Reason: Skills initiate review; evidence entries are reusable substantiation contracts. Forcing complete reverse linkage prematurely creates maintenance burden without improving review quality.

---

## 9. Coverage expansion policy

Sprint 5C pilot: **20 entries**, **26 regulation links**. Approved — not a full 75-regulation backfill.

**Next expansion priority** (by business review frequency and risk):

1. Health claims
2. Performance claims
3. Comparative claims
4. Certification claims

Expand by adding EvidenceRequirements under existing types — not by cloning types per jurisdiction.

---

## 10. KQS interpretation

Evidence Corpus KQS (~97.7% at pilot) measures **asset quality**, not **coverage maturity**.

### 10.1 Asset quality (what KQS measures)

| Dimension | Measures |
|-----------|----------|
| `evidence_purpose` | Purpose completeness |
| `validation_criteria` | Checklist depth |
| `document_ref_spec` | Locator spec for document-backed types |
| `regulation_linkage` | Regulation linked |
| `rule_linkage` | Rule linked |
| `purpose_tags` | Purpose tag presence |
| `applicability` | Countries + claim types |
| Shared | summary, review_guidance, confidence |

High KQS means entries are **well-authored**, not that substantiation knowledge is **complete**.

### 10.2 Coverage maturity (separate from KQS)

Track via **Evidence KQS Gap Report** (planned follow-up):

| Report section | Metrics |
|----------------|---------|
| **Regulation coverage** | `evidence:required` regulations with ≥1 evidence link / total |
| **Market coverage** | Countries with production requirements per claim type |
| **Claim type coverage** | Health / performance / comparative / certification requirement counts |
| **Rewrite resolution** | `expected_evidence_type` values with purpose-mapped production entries |
| **Skill linkage** | Skills with `evidence_requirement: required` and `linkage.evidence` |

**Rule:** Never treat high KQS as full knowledge coverage. Report both scores in dashboard and drift output.

---

## 11. Case Corpus preparation (linkage conventions)

Do not implement Case Corpus until Sprint 5D. Prepare these conventions now:

| Corpus | Case relationship |
|--------|-------------------|
| **Evidence** | Case **validates against** evidence requirement (did substantiation meet criteria?) |
| **Skill** | Case **evaluates** skill (did review capability produce correct outcome?) |
| **Rewrite** | Case **verifies** rewrite guidance (did measurable criteria hold?) |
| **Regulation** | Case cites regulatory ground truth context |

Case Corpus is **validation feedback** — not a duplicate of benchmark fixtures or case-library review blobs.

Planned `case_refs` on Evidence entries will point to `case:{id}` knowledge entries, not raw `case-library/` JSON paths.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-01 | Initial governance doc — Sprint 5C review follow-up |
