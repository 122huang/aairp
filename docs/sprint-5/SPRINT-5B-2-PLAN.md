# Sprint 5B-2 — Rewrite Corpus Plugin

**Status:** Implemented — Sprint 5B-2  
**Theme:** Rewrite Corpus as a Knowledge Corpus — guidance metadata, not a rewrite engine  
**Master roadmap:** [KNOWLEDGE-ROADMAP-v1.0.md](../knowledge/KNOWLEDGE-ROADMAP-v1.0.md)  
**Precedent:** [SPRINT-5B-1-PLAN.md](./SPRINT-5B-1-PLAN.md) (Skill Corpus) · [SKILL-CORPUS.md](../knowledge/SKILL-CORPUS.md)

---

## Constraints (non-negotiable)

| Constraint | Implication |
|------------|-------------|
| Runtime pipeline frozen | No changes to `Rule → Playbook → LLM → Decision` |
| No LLM prompt changes | Rewrite Corpus does not alter open-risk, playbook, or decision prompts |
| No automatic rewriting | Corpus stores **measurable rewrite guidance** only; no text generation or apply-rewrite behavior |
| `rewrite-templates.json` frozen for consumers | `loadRewriteTemplates()`, `matchPlaybookRewriteGuidance()`, benchmark v3 generator/eval **unchanged** |
| Knowledge Platform Core frozen | Extend via **new plugin**; do not fork governance |
| No production runtime loading | Git + governance only until future approved import sprint |
| Preserve shared models | `KnowledgeEntry` envelope + `KnowledgeLinkage` — no parallel rewrite storage |

---

## 1. Architecture understanding

### 1.1 What Rewrite Corpus is (and is not)

| Rewrite Corpus **is** | Rewrite Corpus **is not** |
|----------------------|---------------------------|
| Versioned knowledge describing *how non-compliant copy should be revised* | A rewrite engine or LLM prompt pack |
| Measurable criteria for eval alignment (`must_remove_terms`, `must_include_concepts`) | Automatic text transformation |
| Cross-corpus linkage hub (regulation → rule → skill → rewrite → benchmark) | Runtime consumer of live review output |
| Governance surface (KQS, freshness, coverage, drift vs legacy) | Replacement for `rewrite-templates.json` in eval |

**Eval today:** `benchmark-v3-evaluator` scores the rewrite dimension by comparing playbook finding summaries against `expected_rewrite` expectations loaded from `rewrite-templates.json`. That path remains frozen. Rewrite Corpus **documents and governs** the same contracts at the knowledge layer.

### 1.2 Platform position (post 5B-1)

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Platform Core (5B-E0) — FROZEN                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ implements
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
 Regulation ✓          Skill ✓ (5B-1)     Rewrite (5B-2)
        │                   │                   │
        └─────────── KnowledgeLinkage graph ───┘
                              │
                    Benchmark v3 (frozen consumer)
```

### 1.3 Legacy rewrite assets (remain authoritative for eval)

| Asset | Role today | 5B-2 treatment |
|-------|------------|----------------|
| `docs/knowledge/rewrite-templates.json` | 9 templates; benchmark v3 `expected_rewrite` source | **Unchanged** — eval + scoring consumer |
| `packages/.../rewrite-templates.ts` | Loader + `matchPlaybookRewriteGuidance()` | **Unchanged** |
| `skill-modules.json` → `patterns[].rewrite_template_id` | Pattern → template mapping | **Unchanged**; drift bridge |
| `skill-corpus` → `linkage.rewrites` | `rewrite:{template_id}` refs (warn-only today) | Upgrade to **error** when rewrite plugin registered |
| `benchmark/benchmark-v3.json` | `expected_rewrite.strategy`, `template_id`, terms | **Unchanged**; rewrite corpus links *to* cases |

### 1.4 Knowledge chain (target semantics)

```
Regulation ──grounds──▶ Rule ──triggers──▶ Skill ──recommends──▶ Rewrite ──scores──▶ Benchmark
     │                      │                  │                    │
     └──────────────────────┴──────────────────┴──── Evidence ────┘
                              (substantiation context for cite_evidence rewrites)
```

Rewrite sits **downstream of Skill** and **upstream of Benchmark measurement**. It does not own regulatory decisions (Rules) or review capability definition (Skills).

### 1.5 Conceptual distinction

| Concept | Legacy (`rewrite-templates.json`) | Rewrite Corpus (5B-2) |
|---------|----------------------------------|------------------------|
| Unit | Flat **template** in monolithic JSON | **Rewrite knowledge entry** (one file per template) |
| ID | `template_id` slug | `rewrite_id` + `knowledge_id` (`rewrite:qualify-comparative`) |
| Linkage | None (implicit via skill/benchmark) | Explicit `KnowledgeLinkage` to regulation, rule, skill, evidence, benchmark |
| Lifecycle | None | `rewrite_status` + `rewrite_version` |
| Purpose | Eval scoring contract | Governed, owned, measurable rewrite **guidance** |

5B-2 **does not** replace the 9 legacy templates. It **formalizes** them as knowledge entries with full linkage.

---

## 2. RewriteEntry schema proposal

### 2.1 File layout

```
docs/knowledge/rewrite-corpus/
  README.md
  rewrite-strategies.json          # taxonomy (qualify, remove, disclose, cite_evidence)
  schemas/
    rewrite-corpus-entry.schema.json
  rewrites/
    qualify-performance.json
    qualify-efficacy.json
    ...                            # one file per rewrite entry (9 initial)
  rewrite-corpus.manifest.json     # generated
```

### 2.2 Envelope (shared — unchanged)

From `knowledge-corpus.schema.json`: `knowledge_id`, `corpus_type`, `owner`, `owner_type`, `last_reviewed`, `review_status`, optional `tags`, `confidence_level`, `evidence_requirement`.

### 2.3 Rewrite-specific payload

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `rewrite_id` | string slug | ✓ | Stable key; suffix of `knowledge_id` |
| `rewrite_purpose` | string | ✓ | Why this rewrite guidance exists (plain language) |
| `rewrite_status` | enum | ✓ | `draft` · `validated` · `production` · `deprecated` |
| `rewrite_version` | semver | ✓ | Contract version for the entry |
| `rewrite_strategy` | enum | ✓ | `qualify` · `remove` · `disclose` · `cite_evidence` — **guidance type**, not execution |
| `rewrite_guidance` | string | ✓ | Reviewer-facing: what to change and how (TRIGGER / ACTION / CHECK format) |
| `measurable_criteria` | object | ✓ | Eval-alignable scoring contract (see below) |
| `applicability` | object | ✓ | When this rewrite applies (claim types, countries, modalities) |
| `linkage` | KnowledgeLinkage | ✓ | Cross-corpus links (canonical) |
| `legacy_template_id` | string | optional | Bridge to `rewrite-templates.json` |
| `summary` | string | ✓ | Shared envelope field |
| `review_guidance` | string | ✓ | Shared envelope — reviewer escalation / edge cases |

**`measurable_criteria`** (maps 1:1 to legacy template + benchmark `expected_rewrite`; does **not** execute)

```json
{
  "must_remove_terms": ["perfect", "every time"],
  "must_include_concepts": ["typical", "conditions"],
  "scoring_notes": "Terms checked on original ad text; concepts on rewrite guidance text (benchmark v3 convention)."
}
```

**`applicability`**

```json
{
  "claim_types": ["performance-claim", "superlative-claim"],
  "countries": ["SG", "MY", "TH"],
  "modalities": ["text"]
}
```

**`rewrite_guidance`** (example — guidance only, no decision logic)

```
TRIGGER: Absolute performance wording without conditions. ACTION: Replace with qualified typical-results language. CHECK: On-pack specs and test method reference. ESCALATE IF: No substantiation on file — route to Rule Corpus.
```

### 2.4 Lifecycle (`rewrite_status`)

Mirror Skill Corpus pattern:

| Status | Linkage requirements | Use |
|--------|---------------------|-----|
| `draft` | Recommended | Work in progress |
| `validated` | **Full linkage required** (see §2.5) | Reviewed, not yet released |
| `production` | **Full linkage required** | Active knowledge asset |
| `deprecated` | N/A | Audit retention; excluded from coverage numerators |

### 2.5 Linkage requirements (active entries)

For `validated` / `production` rewrite entries:

| Linkage key | Requirement | Validator |
|-------------|-------------|-----------|
| `linkage.regulations` | ≥1 `regulation:{id}` | **Error** if missing or unknown |
| `linkage.rules` | ≥1 demo rule ID | **Error** if missing or unknown |
| `linkage.skills` | ≥1 `skill:{id}` | **Error** if missing or unknown |
| `linkage.evidence` | ≥1 `evidence:{id}` **or** explicit deferral | See §4.2 |
| `linkage.benchmarks` | ≥1 benchmark `case_id` | **Error** if missing or unknown |
| `linkage.rewrites` | N/A (self-corpus) | — |

**Regulation-independent rewrites** (rare — e.g. pure copy-quality disclose): explicit opt-out mirroring Skill Corpus:

```json
{
  "regulation_scope": "independent",
  "regulation_independence_rationale": "..."
}
```

### 2.6 What is explicitly excluded from RewriteEntry

| Excluded | Owned by |
|----------|----------|
| REJECT / REVIEW / WARN decisions | Rule Corpus |
| Pattern detection signals | Skill Corpus |
| Playbook routing / LLM prompts | Runtime (frozen) |
| Generated rewrite text | Runtime LLM (frozen) |
| Raw evidence documents | Evidence Corpus (5C) |

---

## 3. Relationship with Skill Corpus

### 3.1 Direction of dependency

```
Skill (upstream)                    Rewrite (downstream)
─────────────────                   ────────────────────
detection_patterns[].               rewrite_strategy +
  rewrite_template_id        ──▶      measurable_criteria
output_schema.rewrite_linkage       linkage.skills (back-ref)
linkage.rewrites[]                  linkage.regulations/rules (shared context)
```

- **Skill recommends rewrite guidance** — a skill answers *what to review*; linked rewrites answer *how copy should be revised if non-compliant*.
- **Rewrite does not define review capability** — no detection patterns or checkpoint actions on rewrite entries.
- **Bidirectional integrity:** If `skill:health-claim-review` links `rewrite:remove-health-claim`, then `rewrite:remove-health-claim` must link back `skill:health-claim-review` in `linkage.skills`. Validator enforces mutual reference (error on orphan one-way link).

### 3.2 Mapping today (5 foundation skills → 6 unique templates)

| Skill entry | `linkage.rewrites` (5B-1) | Patterns using template |
|-------------|----------------------------|-------------------------|
| `skill:health-claim-review` | `rewrite:remove-health-claim` | `sa-health-implication` |
| `skill:superlative-claim-review` | qualify-efficacy, qualify-performance, qualify-comparative | 3 patterns |
| `skill:comparative-claim-review` | `rewrite:qualify-comparative` | comparative patterns |
| `skill:certification-claim-review` | `rewrite:cite-evidence` | `sa-certification-evidence` |
| `skill:performance-claim-review` | cite-evidence, qualify-performance | performance/capacity |

**5B-2 initial scope:** Author rewrite corpus entries for all **9 legacy templates**, with primary linkage to the 5 advertising skills where applicable. Disclosure templates (`disclose-localization`, `disclose-ai`, `disclose-urgency`, `disclose-transformation`) link to future/non-advertising skills via `linkage.skills` pointing to planned skill IDs or legacy module bridge until those skills are authored.

### 3.3 Skill Corpus validator upgrade (5B-2 side effect)

When rewrite plugin is registered:

- Skill corpus `unknown_rewrite_link` warnings → **errors** (known rewrite `knowledge_id` set)
- Optional drift report extension: skill `linkage.rewrites` ↔ rewrite `linkage.skills` symmetry

**No changes** to skill entry JSON required in 5B-2 if linkage IDs already use `rewrite:{template_id}` convention matching `rewrite_id`.

---

## 4. Relationship with future Evidence Corpus

### 4.1 Role of evidence in rewrite guidance

| `rewrite_strategy` | Evidence relationship |
|--------------------|----------------------|
| `qualify` | Evidence may support qualified claims; linkage **recommended** |
| `remove` | Evidence rarely required; linkage to regulation suffices |
| `disclose` | Evidence usually N/A; linkage to regulation/disclosure rules |
| `cite_evidence` | Evidence **required** — rewrite guidance assumes substantiation exists |

`cite-evidence` rewrite is the primary bridge between Rewrite and Evidence corpora. Roadmap §10.3 positions Evidence as substantiation knowledge (lab reports, certifications, test methods).

### 4.2 Evidence linkage before Evidence Corpus (5C)

Evidence Corpus does not exist yet (0 entries). User requirement: active rewrite entries must link to Regulation, Rule, Skill, **and** Evidence.

**Proposed staged approach for 5B-2:**

| Phase | Evidence linkage validation |
|-------|----------------------------|
| **5B-2 (now)** | `linkage.evidence` **required** on active entries. IDs use `evidence:{planned-slug}` convention. Validator: **warn** if ID not in Evidence Corpus (empty). For `cite_evidence` strategy: **error** if `linkage.evidence` empty. |
| **5C (Evidence pilot)** | Validator upgrades warn → **error** for unknown evidence IDs. `cite_evidence` rewrites must link to real evidence entries. |
| **5C+ (steady state)** | Expiry freshness on linked evidence; rewrite deprecated when evidence expires |

**5B-2 authoring pattern for `cite-evidence`:**

```json
{
  "linkage": {
    "evidence": ["evidence:substantiation-general-apac"],
    "regulations": ["regulation:sg-asasa-substantiation"],
    "rules": ["demo-apac-sa-certification-evidence"],
    "skills": ["skill:certification-claim-review"]
  },
  "evidence_scope_note": "Placeholder until Evidence Corpus 5C; substantiation type: certification/lab report."
}
```

This satisfies the linkage model structurally without pretending evidence entries exist.

### 4.3 Evidence → Rewrite (future)

When Evidence Corpus ships:

- Evidence entries link **forward** to rewrites that depend on them (`linkage.rewrites`)
- `cite_evidence` rewrites link **back** to specific evidence artifacts
- Case Corpus (5D) may attach evidence refs to rewrite examples in benchmark cases

---

## 5. Migration considerations

### 5.1 Source: 9 legacy templates

| `template_id` | Strategy | Primary skill linkage (5B-2) |
|---------------|----------|------------------------------|
| `qualify-performance` | qualify | `skill:performance-claim-review`, `skill:superlative-claim-review` |
| `qualify-efficacy` | qualify | `skill:superlative-claim-review` |
| `qualify-comparative` | qualify | `skill:comparative-claim-review`, `skill:superlative-claim-review` |
| `remove-health-claim` | remove | `skill:health-claim-review` |
| `cite-evidence` | cite_evidence | `skill:certification-claim-review`, `skill:performance-claim-review` |
| `disclose-localization` | disclose | Legacy: Localization Review (skill TBD) |
| `disclose-ai` | disclose | Legacy: AI Content Review (skill TBD) |
| `disclose-urgency` | disclose | Legacy: Disclaimer Review (skill TBD) |
| `disclose-transformation` | disclose | Legacy: Content Quality Review (skill TBD) |

### 5.2 Migration strategy (non-destructive)

1. **Author** 9 JSON files under `rewrite-corpus/rewrites/` — field mapping from `rewrite-templates.json` + linkage enrichment.
2. **Keep** `rewrite-templates.json` byte-stable for eval unless user approves sync script.
3. **Bridge** via `legacy_template_id` + `rewrite_id` === `template_id` for 1:1 mapping.
4. **Drift report** (E8 pattern from 5B-1): compare rewrite corpus ↔ `rewrite-templates.json` + benchmark `expected_rewrite` usage.
5. **Do not** change `scripts/build-benchmark-v3.mjs` or eval scorer in 5B-2.

### 5.3 Benchmark alignment

Each active rewrite entry should link to ≥1 benchmark `case_id` where `expected_rewrite.template_id` matches `legacy_template_id`. Roadmap gate: *"Every template referenced by ≥1 skill pattern or benchmark rewrite case"* — 5B-2 satisfies via `linkage.benchmarks`.

### 5.4 Regulation / rule linkage authoring

Derive from skill corpus upstream links + regulation corpus entries sharing the same `related_rule_ids`:

- `remove-health-claim` → regulations linked by `skill:health-claim-review`
- `cite-evidence` → `regulation:sg-hsa-certification-marks`, `regulation:sg-asasa-substantiation`
- Disclosure templates → disclosure/disclaimer regulations per market (SG SCAP, etc.)

### 5.5 Risk: dual maintenance

| Risk | Mitigation |
|------|------------|
| `rewrite-templates.json` drifts from rewrite corpus | Drift report in CI; non-blocking initially |
| Skill `linkage.rewrites` out of sync | Bidirectional linkage validator |
| Evidence placeholders never resolved | 5C migration checklist; KQS dimension `evidence_linkage` |
| Scope creep into rewrite engine | PR gate: no imports from `review/` or LLM gateways in rewrite corpus code |

---

## 6. Implementation plan

### 6.1 Epic breakdown

| Epic | Scope | Outcome |
|------|-------|---------|
| **E1** | Schema & taxonomy | `rewrite-corpus-entry.schema.json`, `rewrite-strategies.json`, `REWRITE-CORPUS.md` |
| **E2** | Nine sample rewrite entries | Migrate all legacy templates with full linkage |
| **E3** | Loader + adapter | `rewrite-corpus.ts`, `rewrite-entry.adapter.ts` |
| **E4** | Platform plugin | `rewrite-corpus.plugin.ts` + register in `knowledge-platform.ts` |
| **E5** | Governance facades | Validator, coverage, KQS, index, dashboard, CLI commands |
| **E6** | Tests | Loader, governance, platform snapshot (3 corpora) |
| **E7** | Docs | Authoring standard §2.x update, roadmap KPI note, sprint README |
| **E8** | Drift report | Rewrite corpus ↔ `rewrite-templates.json` ↔ benchmark template usage |
| **E9** | Skill validator upgrade | Promote `unknown_rewrite_link` to error when rewrite plugin registered |

**Explicitly out of scope for 5B-2:**

- `rewrite-templates.json` deletion or eval consumer migration
- Runtime / LLM / playbook rewrite behavior changes
- Evidence Corpus plugin (5C)
- Automatic rewrite text generation
- KOS import / Knowledge Pack fingerprints (5B-4)

### 6.2 KQS dimensions (rewrite-specific)

| Dimension | Measures |
|-----------|----------|
| `rewrite_purpose` | Purpose field completeness |
| `rewrite_guidance` | Guidance field completeness |
| `measurable_criteria` | Terms/concepts declared |
| `strategy_classification` | Valid `rewrite_strategy` |
| `regulation_linkage` | ≥1 regulation linked |
| `rule_linkage` | ≥1 rule linked |
| `skill_linkage` | ≥1 skill linked |
| `evidence_linkage` | Evidence present (weighted by strategy) |
| `benchmark_linkage` | ≥1 benchmark case |
| + shared | summary, review_guidance, confidence, evidence classification |

### 6.3 Validator errors vs warnings

| Code | Severity |
|------|----------|
| Invalid envelope / duplicate `knowledge_id` | Error |
| Missing regulation/rule/skill/benchmark linkage (active) | Error |
| Unknown linkage target ID | Error |
| Missing evidence linkage on `cite_evidence` | Error |
| Unknown `evidence:{id}` (pre-5C) | Warning |
| One-way skill ↔ rewrite link | Error |
| Drift from `rewrite-templates.json` measurable_criteria | Warning |
| Orphan rewrite (no skill or benchmark ref) | Warning |

### 6.4 Files to create (planned)

```
docs/knowledge/rewrite-corpus/**           # source + schema + 9 entries
docs/knowledge/REWRITE-CORPUS.md
docs/sprint-5/SPRINT-5B-2-PLAN.md         # this document

packages/application/src/knowledge/
  rewrite-corpus.ts
  corpus/rewrite-entry.adapter.ts
  corpus/rewrite-corpus.plugin.ts
  rewrite-corpus-{validator,coverage,kqs,index,dashboard,drift}.ts
  run-*-rewrite-corpus-*.ts
  rewrite-corpus.spec.ts
  rewrite-corpus-governance.spec.ts
```

### 6.5 Files to modify (minimal)

| File | Change |
|------|--------|
| `platform/knowledge-platform.ts` | Register rewrite plugin |
| `corpus/skill-corpus.plugin.ts` | Known rewrite IDs from rewrite corpus; promote warn → error |
| `package.json` (root + application) | `knowledge:*-rewrite-corpus-*` scripts |
| `KNOWLEDGE-AUTHORING-STANDARD.md` | Rewrite Corpus section |
| `KNOWLEDGE-ROADMAP-v1.0.md` | Rewrite row → plugin registered (post-implementation) |

### 6.6 Files explicitly NOT modified

| File | Reason |
|------|--------|
| `rewrite-templates.json` | Eval consumer frozen |
| `rewrite-templates.ts` | Scoring logic frozen |
| `benchmark-v3-evaluator.service.ts` | No eval behavior change |
| `demo/playbook.demo.md` | Runtime frozen |
| `review/**` | No runtime / LLM changes |

### 6.7 Commands (planned)

```bash
pnpm knowledge:build-rewrite-corpus-index
pnpm knowledge:validate-rewrite-corpus
pnpm knowledge:rewrite-corpus-coverage-report
pnpm knowledge:rewrite-corpus-dashboard
pnpm knowledge:rewrite-corpus-drift-report
pnpm knowledge:platform-dashboard          # 3 corpora after registration
```

### 6.8 Acceptance criteria

- [ ] 9 rewrite entries under `rewrite-corpus/rewrites/` with valid envelope + payload
- [ ] Active entries link to ≥1 regulation, rule, skill, benchmark each
- [ ] `cite_evidence` entries have `linkage.evidence` populated
- [ ] Bidirectional skill ↔ rewrite linkage validates with 0 errors
- [ ] Skill corpus `unknown_rewrite_link` resolved (0 errors on re-validate skill)
- [ ] Plugin registered; platform dashboard shows 3 corpora
- [ ] `rewrite-templates.json` unchanged unless explicitly approved
- [ ] Zero runtime / LLM / eval scorer changes

---

## 7. Open questions for review

1. **Evidence linkage (pre-5C):** Accept `evidence:{planned-slug}` with warn-only validation until Evidence Corpus ships, or require regulation-proxy linkage only for `cite_evidence`?
2. **Disclosure templates:** Author with `regulation_scope: independent` + legacy module bridge, or wait for Localization/Disclaimer skill corpus entries (5B-1.x)?
3. **Bidirectional linkage:** Enforce strict symmetry (skill ↔ rewrite) as **error** in 5B-2, or warn-only initially?
4. **Entry granularity:** Confirm one JSON per template (`rewrite_id` === legacy `template_id`) — recommended.
5. **Locale variants (roadmap 12-mo):** Defer `rewrite_id` locale suffixes (`qualify-comparative-en-SG`) to post-5B-2?

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-01 | Initial Sprint 5B-2 plan — analysis only, no implementation |
