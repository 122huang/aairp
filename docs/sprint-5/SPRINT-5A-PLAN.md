# Sprint 5A — Regulation Corpus (First Knowledge Corpus)

**Status:** Approved  
**Duration:** ~2 weeks  
**Theme:** Regulation Corpus as the **first subtype** of the Knowledge Corpus — not a standalone regulation project.

---

## 1. Objective

Build the first production-grade **Regulation Corpus** under the **Knowledge Corpus** architecture: versioned source files, generated index, and coverage reporting for seven APAC markets.

Sprint 5A delivers **Knowledge Layer artifacts only**. Future sprints expand **all** corpus types (Skill, Evidence, Case, Rewrite) — not regulations alone.

| In scope | Out of scope |
|----------|--------------|
| Regulation Corpus schema, files, index, coverage report | Runtime pipeline changes |
| Generic corpus fields (`corpus_type`, `knowledge_id`) | New rules, playbooks, rule-engine logic |
| Reserved `related_evidence_ids` for future Evidence Corpus | KOS → runtime export |
| Loaders, validators, CLI reports | Corpus volume beyond ~70–80 regulations |
| Optional Knowledge Pack manifest fingerprint | CI hard gates |

---

## 2. Knowledge Corpus architecture

### 2.1 Positioning

**Regulation Corpus is a subtype of Knowledge Corpus**, not a separate knowledge system.

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Corpus (umbrella)                                 │
│  Versioned · indexed · coverage-reportable · owned         │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  Regulation Corpus    Evidence Corpus     Case Corpus
  (Sprint 5A)          (future)            (future)
        │                   │                   │
        ▼                   ▼                   ▼
  Internal Skill       Rewrite Corpus      (cross-links via
  Corpus (future)      (future)             knowledge_id)
```

Long-term, all corpora share:

- A common **envelope** (`corpus_type`, `knowledge_id`, ownership, review metadata)
- **Type-specific payloads** (regulation fields, evidence artifacts, case refs, etc.)
- **Cross-corpus linkage** fields (`related_rule_ids`, `related_evidence_ids`, …)
- Generated **index** + **coverage** reports per corpus (and eventually rolled up)

### 2.2 Corpus types (`corpus_type`)

Reserved enum for all Knowledge Corpus entries:

| Value | Corpus | Sprint |
|-------|--------|--------|
| `regulation` | Regulation Corpus | **5A** |
| `skill` | Internal Skill Corpus | Future |
| `evidence` | Evidence Corpus | Future |
| `case` | Case Corpus | Future |
| `rewrite` | Rewrite Corpus | Future |

Every Regulation Corpus entry sets `corpus_type: "regulation"`.

### 2.3 Identifiers

| Field | Role |
|-------|------|
| **`knowledge_id`** | Long-term canonical identifier across all corpus types. Format: `{corpus_type}:{stable-key}` e.g. `regulation:sg-hpa-s7-prohibited-claims` |
| **`regulation_id`** | Type-specific stable key for regulation entries in 5A (may equal the suffix of `knowledge_id`). Retained for clarity and migration from demo seeds. |

New corpus types in future sprints use `knowledge_id` without redesigning the envelope.

### 2.4 Evidence as first-class knowledge

**Evidence** (laboratory reports, certifications, test methods) is a planned corpus type, not an afterthought.

Regulation entries reserve optional linkage for future Evidence Corpus integration:

```json
{
  "knowledge_id": "regulation:sg-hpa-s7-prohibited-claims",
  "corpus_type": "regulation",
  "regulation_id": "sg-hpa-s7-prohibited-claims",
  "related_rule_ids": ["demo-sg-health-forbidden-claim"],
  "related_evidence_ids": []
}
```

`related_evidence_ids` references future `knowledge_id` values with `corpus_type: "evidence"`. Empty in 5A; validator accepts `[]` only.

### 2.5 Relationship to runtime and existing artifacts

```
docs/knowledge/regulation-corpus/     ← Sprint 5A source of truth
        │
        ├── regulation-corpus.manifest.json   (generated index)
        └── coverage report                   (generated)

demo/rules.demo.json                    ← unchanged (runtime)
DEMO_REGULATION_SEEDS (3)               ← unchanged (runtime demo)
KOS regulation_version                  ← unchanged in 5A

Knowledge Pack manifest                 ← optional corpus fingerprint (metadata only)
```

Runtime continues to load `demo/rules.demo.json` and demo regulation seeds. The Regulation Corpus informs **governance, coverage, and future KOS import** — not live review behavior.

### 2.6 Scope discipline

- **~70–80 regulations** for 5A is sufficient. Do not expand authoring scope.
- Future value comes from **expanding all Knowledge Corpora** (Skill, Evidence, Case, Rewrite), not from inflating regulation count alone.

---

## 3. Regulation Corpus schema (5A)

### 3.1 File layout

```
docs/knowledge/regulation-corpus/
  README.md
  regulation-categories.json
  countries.json
  regulations/
    SG/*.json
    MY/*.json
    TH/*.json
    ID/*.json
    JP/*.json
    KR/*.json
    AU/*.json
  regulation-corpus.manifest.json    # generated
```

### 3.2 Entry envelope (shared across future corpora)

| Field | Type | Required (5A) | Notes |
|-------|------|:-------------:|-------|
| `knowledge_id` | string | ✓ | Canonical ID, e.g. `regulation:sg-hpa-s7-prohibited-claims` |
| `corpus_type` | enum | ✓ | Always `regulation` in 5A |
| `regulation_id` | string | ✓ | Type-specific key (regulation entries) |
| `owner` | string | ✓ | |
| `owner_type` | enum | ✓ | `legal` \| `compliance` \| `knowledge_eng` \| `product` |
| `last_reviewed` | ISO datetime | ✓ | |
| `review_status` | enum | ✓ | `draft` \| `legal_reviewed` \| `deprecated` |

### 3.3 Regulation-specific fields

| Field | Type | Required |
|-------|------|:--------:|
| `country` | `SG` \| `MY` \| `TH` \| `ID` \| `JP` \| `KR` \| `AU` | ✓ |
| `authority` | string | ✓ |
| `regulation_name` | string | ✓ |
| `citation` | string | ✓ |
| `effective_date` | ISO date | ✓ |
| `category` | enum (12 categories) | ✓ |
| `mandatory` | boolean | ✓ |
| `risk_level` | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` | ✓ |
| `summary` | string | ✓ |
| `review_guidance` | string | ✓ |
| `related_rule_ids` | string[] | ✓ (may be `[]`) |
| `related_evidence_ids` | string[] | ✓ (always `[]` in 5A) |
| `source_url` | string | optional |
| `tags` | string[] | optional |
| `jurisdiction_scope` | string[] | optional |

### 3.4 Categories (fixed)

Health Claims · Medical Claims · Comparative Advertising · Environmental Claims · Certification · Safety Claims · Performance Claims · Pricing · Consumer Protection · AI-generated Content · Image Usage · Mandatory Disclaimers

### 3.5 Countries

Singapore · Malaysia · Thailand · Indonesia · Japan · South Korea · Australia

---

## 4. Epic breakdown (implementation scope — unchanged)

### E1 — Schema & taxonomy (Days 1–2)

- `regulation-categories.json`, `countries.json`
- `knowledge-corpus.schema.json` (envelope) + `regulation-corpus-entry.schema.json` (regulation payload)
- TypeScript loader with `corpus_type` + `knowledge_id` types
- `REGULATION-CORPUS.md` authoring guide

### E2 — Corpus authoring (Days 2–8)

- **Target: ~70–80 regulations** across 7 countries
- Prioritize high-frequency advertising review categories; gaps reported in coverage report, not filled by even distribution
- Migrate semantic content from 3 demo seeds into SG corpus entries (demo seeds unchanged)

### E3 — Index generator (Days 3–4)

- `scripts/build-regulation-corpus-index.mjs`
- `regulation-corpus.manifest.json` with fingerprint, `by_country`, `by_category`

### E4 — Coverage report (Days 4–5)

- Country Coverage · Category Coverage · Missing Categories · Missing Countries
- `pnpm knowledge:regulation-coverage-report`

### E5 — Validation & tests (Days 5–6)

- Schema validation, duplicate `knowledge_id` / `regulation_id` checks
- `related_rule_ids` must exist in `demo/rules.demo.json` or be `[]`
- `related_evidence_ids` must be `[]` in 5A (reserved for future)

### E6 — Knowledge Pack hook (optional, Days 6–7)

- Manifest metadata: `regulation_corpus` component (count, fingerprint) — no runtime load

---

## 5. Commands

```bash
pnpm knowledge:build-regulation-corpus-index
pnpm knowledge:validate-regulation-corpus
pnpm knowledge:regulation-coverage-report
```

---

## 6. Acceptance criteria

- [ ] Knowledge Corpus architecture documented (this plan + README)
- [ ] Every entry has `corpus_type: "regulation"` and `knowledge_id`
- [ ] Every entry has `regulation_id` and all regulation-specific required fields
- [ ] `related_evidence_ids` present (empty array) on all entries
- [ ] ~70–80 regulations, 7 countries, frequency-prioritized category coverage
- [ ] Index + coverage report with four required sections
- [ ] Validator: 0 errors
- [ ] **Zero** runtime / review pipeline changes

---

## 7. Future corpora (out of scope — architecture reserved)

| Corpus | `corpus_type` | Primary linkage from regulations |
|--------|---------------|----------------------------------|
| Internal Skill Corpus | `skill` | Skill modules, playbooks |
| Evidence Corpus | `evidence` | `related_evidence_ids` |
| Case Corpus | `case` | Case library `knowledge_id` refs |
| Rewrite Corpus | `rewrite` | Rewrite templates |

Sprint 5B+ will add corpus-specific schemas reusing the same envelope pattern.
