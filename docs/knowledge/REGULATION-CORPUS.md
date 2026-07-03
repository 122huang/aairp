# Regulation Corpus — Authoring Guide

Sprint 5A source-of-truth for advertising and marketing **regulations** across seven APAC markets. Each file is one regulation entry under the shared [Knowledge Corpus](./KNOWLEDGE-ROADMAP.md) envelope.

**Shared authoring standard:** [KNOWLEDGE-AUTHORING-STANDARD.md](./KNOWLEDGE-AUTHORING-STANDARD.md)

---

## 1. When to add an entry

Add a regulation entry when you need a durable, owned record of:

- A statutory or code obligation relevant to ad review
- Guidance that should link to demo or production rules (`related_rule_ids`)
- Future evidence linkage (`related_evidence_ids`, reserved for Evidence Corpus)

Do **not** add entries to change runtime behavior in Sprint 5A. Runtime continues to use `demo/rules.demo.json` and `DEMO_REGULATION_SEEDS`.

---

## 2. File location

One JSON file per regulation:

```
docs/knowledge/regulation-corpus/regulations/{COUNTRY}/{regulation_id}.json
```

| Country code | Market |
|--------------|--------|
| `SG` | Singapore |
| `MY` | Malaysia |
| `TH` | Thailand |
| `ID` | Indonesia |
| `JP` | Japan |
| `KR` | South Korea |
| `AU` | Australia |

The filename should match `regulation_id` (e.g. `sg-hpa-s7-prohibited-claims.json`).

---

## 3. Identifiers

| Field | Rule |
|-------|------|
| `knowledge_id` | `regulation:{regulation_id}` — canonical across all corpus types |
| `regulation_id` | Lowercase slug: `^[a-z0-9][a-z0-9-]*$` |
| `corpus_type` | Always `"regulation"` |

Example:

```json
{
  "knowledge_id": "regulation:sg-hpa-s7-prohibited-claims",
  "corpus_type": "regulation",
  "regulation_id": "sg-hpa-s7-prohibited-claims"
}
```

The suffix of `knowledge_id` must equal `regulation_id`.

---

## 4. Required fields

### Envelope (all corpus types)

| Field | Description |
|-------|-------------|
| `owner` | Contact or team mailbox |
| `owner_type` | `legal` \| `compliance` \| `knowledge_eng` \| `product` |
| `last_reviewed` | ISO 8601 date-time |
| `review_status` | `draft` \| `legal_reviewed` \| `deprecated` |

### Regulation payload

| Field | Description |
|-------|-------------|
| `country` | `SG` \| `MY` \| `TH` \| `ID` \| `JP` \| `KR` \| `AU` |
| `authority` | Regulator or code body (see `countries.json`) |
| `regulation_name` | Full instrument name |
| `citation` | Section, rule, or article reference |
| `effective_date` | `YYYY-MM-DD` |
| `category` | One of 12 categories in `regulation-categories.json` |
| `mandatory` | Whether compliance is mandatory for covered ads |
| `risk_level` | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` |
| `summary` | Short plain-language summary |
| `review_guidance` | Actionable guidance for reviewers |
| `related_rule_ids` | Rule IDs in `demo/rules.demo.json` (may be `[]`) |
| `related_evidence_ids` | Future `evidence:…` IDs; use `[]` in Sprint 5A |

### Optional

| Field | Description |
|-------|-------------|
| `source_url` | Official publication URL |
| `tags` | Free-form labels |
| `jurisdiction_scope` | Product or channel scopes (e.g. `health.supplement`) |

---

## 5. Categories

Use the `name` value from `regulation-categories.json`:

Health Claims · Medical Claims · Comparative Advertising · Environmental Claims · Certification · Safety Claims · Performance Claims · Pricing · Consumer Protection · AI-generated Content · Image Usage · Mandatory Disclaimers

---

## 6. Linkage rules

- **`related_rule_ids`:** Must reference an existing rule in `demo/rules.demo.json`, or be an empty array. Validated in E5.
- **`related_evidence_ids`:** Must be `[]` in Sprint 5A. When Evidence Corpus exists, entries use `evidence:{stable-key}`.

---

## 7. Review workflow

1. Author as `review_status: "draft"`.
2. Legal review → set `legal_reviewed` and update `last_reviewed`.
3. Deprecate superseded entries with `deprecated` (do not delete files without governance sign-off).

---

## 8. Schema validation

JSON Schema files:

- `schemas/knowledge-corpus.schema.json` — shared envelope
- `schemas/regulation-corpus-entry.schema.json` — regulation entry

Validate with `pnpm knowledge:validate-regulation-corpus` (E5).

---

## 9. Demo seed migration (reference)

Three Singapore demo seeds are mirrored in the corpus for linkage and coverage. Runtime demo seeds are **unchanged**:

| Demo seed | Corpus `regulation_id` | Category |
|-----------|------------------------|----------|
| `sg-hpa-s7` | `sg-hpa-s7-prohibited-claims` | Medical Claims |
| `sg-asasa-substantiation` | `sg-asasa-substantiation` | Comparative Advertising |
| `sg-scap-disclosure` | `sg-scap-disclosure` | Mandatory Disclaimers |

---

## 10. Commands

| Command | Epic | Purpose |
|---------|------|---------|
| `node scripts/seed-regulation-corpus-e2.mjs` | E2 | Materialize batch entries to `regulations/{country}/` |
| `pnpm knowledge:build-regulation-corpus-index` | E3 | Generate manifest |
| `pnpm knowledge:regulation-dashboard` | E3–E5 | Integrated governance dashboard |
| `pnpm knowledge:regulation-coverage-report` | E4 | Country/category coverage + freshness |
| `pnpm knowledge:validate-regulation-corpus` | E5 | Schema + linkage + governance warnings |

TypeScript API: `loadRegulationCorpus()`, `loadRegulationCorpusEntries()` in `@aairp/application`.

### E2 authoring batch

Frequency-prioritized entries are authored in `e2-authoring-batch.json` and materialized with the seed script. Demo seed files under `regulations/SG/` are preserved (not overwritten).

---

## 11. Knowledge Quality Score (KQS)

Reporting-only quality metric per entry and for the corpus overall. Does not affect runtime.

| Dimension | Measures |
|-----------|----------|
| Citation completeness | Locatable citation with instrument and section |
| Source quality | Official URL or authority metadata |
| Summary completeness | Plain-language summary |
| Review guidance completeness | TRIGGER / ACTION / CHECK template |
| Confidence classification | `confidence:*` tag |
| Evidence classification | `evidence:*` tag |
| Rule linkage | `related_rule_ids` coverage |

Commands: `pnpm knowledge:regulation-dashboard`, `pnpm knowledge:regulation-coverage-report`.
