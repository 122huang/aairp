# Knowledge Authoring Standard

**Status:** Approved  
**Applies to:** All Knowledge Corpora — Regulation, Skill, Evidence, Case, Rewrite  
**Related:** [KNOWLEDGE-ROADMAP-v1.0.md](./KNOWLEDGE-ROADMAP-v1.0.md) · [REGULATION-CORPUS.md](./REGULATION-CORPUS.md)

This standard defines how AAIRP knowledge entries are authored, cited, and reviewed. It is corpus-agnostic: type-specific schemas add fields, but the writing and evidence rules below apply to every corpus.

---

## 1. Source hierarchy

When authoring or updating knowledge, prefer sources in this order. Do not treat a lower tier as equivalent to a higher tier.

| Tier | Source type | Examples | Use in AAIRP |
|------|-------------|----------|--------------|
| **1** | Official regulation | Acts, statutory instruments, gazetted rules | Primary citation; mandatory obligations |
| **2** | Official guidance | Regulator circulars, HSA/ACCC/TGA guidance notes | Interpretation; review guidance |
| **3** | Industry code | ASAS SCAP, Ad Standards codes, self-regulatory frameworks | Best practice; disclosure and substantiation norms |
| **4** | Internal knowledge | Prior legal memos, pilot findings, benchmark notes | Context only; must cite upstream source in summary |

**Rules:**

- Every entry must trace to **Tier 1–3** for its core claim. Tier 4 may supplement but cannot be the sole basis.
- If Tier 1 and Tier 3 conflict, **Tier 1 wins**. Note the conflict in `review_guidance`.
- Deprecated or superseded instruments must set `review_status: "deprecated"` and point to the replacement entry via tags (e.g. `supersedes:regulation:…`).

---

## 2. Citation format

Citations must be **locatable** by a reviewer without opening external systems.

### 2.1 Regulation Corpus

Use the `citation` field:

```
{Instrument short name} — {Section | Rule | Article | Clause reference}
```

**Examples:**

- `Health Products Act — Section 7 (Prohibited claims)`
- `Singapore Code of Advertising Practice — Rule 2.1 (Identification)`
- `Australian Consumer Law — Schedule 2, s 18 (Misleading or deceptive conduct)`

### 2.2 Skill Corpus

| Field | Format |
|-------|--------|
| `skill_id` | Stable slug matching `knowledge_id` suffix (`skill:health-claim-review`) |
| `skill_purpose` | One sentence — review capability scope (not regulatory outcome) |
| `detection_patterns[].playbook_pattern_id` | Playbook section ID (reference only; warn if missing) |
| `linkage.regulations` | `regulation:{stable-key}` — **required** for `validated` / `production` skills |
| `linkage.rules` | Demo rule IDs — execution binds to Rule Corpus, not skill entry |
| `review_guidance` | TRIGGER / ACTION / CHECK / ESCALATE IF (see §4) |

Skill entries define **review capability and execution guidance**. They do **not** encode REJECT/REVIEW/WARN decision logic — that remains in Rule Corpus.

See [SKILL-CORPUS.md](./SKILL-CORPUS.md) for full authoring rules.

### 2.3 Rewrite Corpus

| Field | Format |
|-------|--------|
| `rewrite_id` | Stable slug; `knowledge_id` = `rewrite:{rewrite_id}` |
| `legacy_template_id` | Maps to `rewrite-templates.json` `template_id` |
| `rewrite_strategy_type` | `qualify` · `remove` · `disclose` · `cite_evidence` |
| `rewrite_guidance` | TRIGGER / ACTION / CHECK reviewer guidance (not LLM instructions) |
| `measurable_criteria` | `must_remove_terms`, `must_include_concepts` — eval alignment only |
| `benchmark_refs` | benchmark-v3 `case_id` list |
| `case_refs` | Future `case:…` IDs (Case Corpus) |
| `expected_evidence_type` | Rewrite enum; resolves to Evidence entries via purpose/type mapping |
| `linkage.regulations` / `rules` / `skills` | Cross-corpus links |

Rewrite entries define **measurable revision guidance** — not generated text, rewrite engines, or decision logic.

See [REWRITE-CORPUS.md](./REWRITE-CORPUS.md).

### 2.4 Evidence Corpus

| Field | Rule |
|-------|------|
| `evidence_type_key` | Taxonomy type — future **EvidenceType** |
| `requirement_scope` | Claim-class scope — future **EvidenceRequirement**; no jurisdiction in `evidence_id` |
| `document_ref_spec` | Locator metadata only — required for certification, lab_report, clinical, patent |
| `validation_criteria` | Declarative reviewer checklist — not auto-verification |
| `linkage.regulations` / `rules` / `skills` / `rewrites` | Cross-corpus links |

Evidence entries define **substantiation contracts** — not document storage. See [EVIDENCE-CORPUS.md](./EVIDENCE-CORPUS.md) and [EVIDENCE-GOVERNANCE.md](./EVIDENCE-GOVERNANCE.md).

### 2.5 Case Corpus

| Field | Format |
|-------|--------|
| `benchmark_ref` | benchmark-v3 `case_id` — one entry per case_id (pilot) |
| `verification_status` | Quality confidence — separate from `case_status` lifecycle |
| `ground_truth_spec` | Eval dimension expectations; `evidence_validation` when Skill/Rewrite requires evidence |
| `case_result` | Declarative outcome linkage — no runtime scoring |
| `source_case_id` | case-library or KOS locator — metadata only until 5D.1 |

See [CASE-CORPUS.md](./CASE-CORPUS.md).

### 2.6 Optional `source_url`

- Use the **canonical official URL** (regulator or government publisher).
- Do not use news articles, blogs, or aggregator sites as `source_url`.
- If no stable URL exists, omit the field; do not substitute a broken link.

---

## 3. Summary writing standard

The `summary` field is the **first read** for reviewers and evaluators.

| Rule | Requirement |
|------|-------------|
| Length | 1–3 sentences; ≤ 280 characters preferred |
| Voice | Plain language; active voice |
| Content | State **what is restricted, required, or prohibited** — not legal history |
| Avoid | "This regulation relates to…", vague qualifiers, duplicate of `regulation_name` |
| Locale | English for 5A; local-language quotes only when essential, with English gloss in parentheses |

**Good:**

> Prohibited disease-treatment and cure claims for health products. Absolute efficacy statements require substantiation or must be removed.

**Bad:**

> This is an important regulation under the Health Products Act that deals with various types of claims that companies might make.

---

## 4. Review guidance template

The `review_guidance` field must be **actionable** for ad review. Use this structure (sections may be merged into one paragraph if short):

```
TRIGGER: [claim types, phrases, or contexts that activate this entry]
ACTION: [REJECT | REWRITE | WARN | ESCALATE — primary reviewer action]
CHECK: [specific elements to verify in copy, creative, or metadata]
ESCALATE IF: [conditions requiring legal/compliance escalation]
```

**Example:**

```
TRIGGER: Cure, eliminate, or guaranteed treatment language for health products.
ACTION: REJECT — remove prohibited claims before publication.
CHECK: Headlines, body copy, testimonials, and on-pack claims in the ad.
ESCALATE IF: Claim references a scheduled medicine or serious disease indication.
```

For non-regulation corpora, adapt labels:

- **Skill:** `ACTIVATE WHEN` / `APPLY` / `VERIFY` / `ESCALATE IF`
- **Evidence:** `ACCEPT WHEN` / `REJECT WHEN` / `VERIFY` / `ESCALATE IF`
- **Rewrite:** `WHEN TO USE` / `MUST REMOVE` / `MUST INCLUDE` / `ESCALATE IF`

---

## 5. Confidence level

Every entry must declare authoring confidence. Until schema fields are added corpus-wide, use tags:

| Tag | Meaning | When to use |
|-----|---------|-------------|
| `confidence:high` | Verified against Tier 1–2 source; legal reviewed | Production-ready entries |
| `confidence:medium` | Based on Tier 3 code or consolidated guidance; legal spot-check | Default for new corpus authoring |
| `confidence:low` | Preliminary mapping; needs legal verification | Draft entries only |

**Rules:**

- `review_status: "legal_reviewed"` requires `confidence:high`.
- `review_status: "draft"` may use `confidence:medium` or `confidence:low`.
- Do not publish regression-linked or rule-linked entries at `confidence:low`.

---

## 6. Evidence requirement classification

Classifies what substantiation a reviewer should expect before allowing a claim. Use tags (future: dedicated schema field on regulation and skill entries):

| Tag | Meaning | Reviewer expectation |
|-----|---------|----------------------|
| `evidence:none` | Prohibition or disclosure rule; no substantiation can override | Apply rule regardless of evidence |
| `evidence:recommended` | Claim allowed if reasonable basis exists; evidence not always on file | WARN or qualify; request evidence for high-risk copy |
| `evidence:required` | Comparative, performance, certification, or health benefit claims | Do not pass without linked `related_evidence_ids` (future) or manual evidence check |

**Mapping to claim types (Regulation Corpus):**

| Category | Typical classification |
|----------|------------------------|
| Medical Claims | `evidence:none` (prohibitions) or `evidence:required` (allowed therapeutic wording) |
| Health Claims | `evidence:required` |
| Comparative / Performance | `evidence:required` |
| Certification | `evidence:required` |
| Mandatory Disclaimers | `evidence:none` |
| Pricing / Consumer Protection | `evidence:none` or `evidence:recommended` |
| Environmental Claims | `evidence:required` |
| Safety Claims | `evidence:required` |
| AI-generated Content / Image Usage | `evidence:none` (disclosure rules) or `evidence:recommended` |

---

## 7. Ownership and review lifecycle

| Field | Standard |
|-------|----------|
| `owner` | Team mailbox or named role (e.g. `legal-apac@aairp`) |
| `owner_type` | `legal` for regulatory obligations; `compliance` for codes; `knowledge_eng` for internal skill/case |
| `last_reviewed` | ISO 8601 UTC timestamp of last substantive review |
| `review_status` | `draft` → `legal_reviewed` → (`deprecated` when superseded) |

Re-review triggers: source amendment, benchmark regression failure linked to entry, or 180 days since `last_reviewed` (see KOS ownership lifecycle).

---

## 8. Knowledge Quality Score (reporting)

KQS is a read-only 0–100 score per entry and for the corpus. Seven dimensions: citation, source, summary, review guidance, confidence tag, evidence tag, rule linkage. See [REGULATION-CORPUS.md](./REGULATION-CORPUS.md) §11.

Freshness bands (reporting only): green &lt;180 days, yellow 180–365 days, red &gt;365 days since `last_reviewed`.

---

## 9. Cross-corpus linkage

| Field | Rule |
|-------|------|
| `related_rule_ids` | Only IDs that exist in the active rule pack; use `[]` if none |
| `related_evidence_ids` | `evidence:{key}` IDs validated against Evidence Corpus |
| Tags `links:…` | Optional cross-refs to case or skill IDs for traceability |

---

## 10. Authoring checklist

Before marking an entry `legal_reviewed`:

- [ ] Source tier documented (Tier 1–3 cited in summary or tags)
- [ ] Citation is locatable
- [ ] Summary ≤ 3 sentences, plain language
- [ ] Review guidance follows TRIGGER / ACTION / CHECK / ESCALATE IF
- [ ] `confidence:high` tag present
- [ ] Evidence classification tag present
- [ ] `knowledge_id` matches `{corpus_type}:{stable-key}`
- [ ] No runtime behavior implied — knowledge layer only

---

## 11. Sprint 5A application

Regulation Corpus E2 authoring uses this standard. Entries are frequency-prioritized (health, medical, comparative, disclosure, performance first). Low-frequency categories are represented lightly; gaps are reported in the coverage report, not backfilled for even distribution.

See [REGULATION-CORPUS.md](./REGULATION-CORPUS.md) for file layout and schema fields.
