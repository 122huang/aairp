# Evidence Corpus

Substantiation knowledge for the Knowledge Platform. Defines **evidence requirements**, **types**, **validation criteria**, and **cross-corpus linkage** — not a document repository.

**Governance:** [EVIDENCE-GOVERNANCE.md](./EVIDENCE-GOVERNANCE.md)

## Model

| Field | Role |
|-------|------|
| `evidence_type_key` | Taxonomy type — future **EvidenceType** |
| `requirement_scope` | Claim-class scope — future **EvidenceRequirement** |
| `evidence_purpose_tags` | Purpose-level tags for rewrite resolution |
| `resolves_expected_evidence_types` | Maps to Rewrite `expected_evidence_type` via purpose/type mapping |
| `applicability.countries` | Jurisdiction lives here, not in `evidence_id` |
| `document_ref_spec` | Locator metadata only — required for certification, lab_report, clinical, patent |

### Future split: EvidenceType vs EvidenceRequirement

Before corpus expansion, entries will split into:

- **EvidenceType** — reusable category (e.g. `clinical_substantiation`)
- **EvidenceRequirement** — jurisdiction / claim / regulatory context (e.g. SG health claim, MY health claim)

Do not duplicate entries only because jurisdiction differs. See [EVIDENCE-GOVERNANCE.md §3](./EVIDENCE-GOVERNANCE.md#3-evidencetype-vs-evidencerequirement-future-split).

## Linkage rules

| Direction | Rule |
|-----------|------|
| Evidence → Regulation | **Required** (or `regulation_scope: independent`) |
| Evidence → Rule | Recommended (warn if missing) |
| Skill → Evidence | **Error** when `evidence_requirement: required` |
| Evidence → Skill | **Warn** if asymmetric (keep until Case Corpus maturity) |
| Rewrite resolution | `expected_evidence_type` resolves via `evidence-types.json` purpose mapping |

## KQS interpretation

KQS measures **asset quality** (schema, linkage, validation criteria) — not **coverage maturity** (regulation / market / claim-type completeness). Use the planned **KQS Gap Report** to track coverage separately. See [EVIDENCE-GOVERNANCE.md §10](./EVIDENCE-GOVERNANCE.md#10-kqs-interpretation).

## Pilot scope (20 entries)

- Certification substantiation (5)
- Laboratory reports (2)
- Test methods (2)
- Performance substantiation (3)
- Health substantiation (3)
- Comparative substantiation (3)
- Efficacy / general substantiation (2)

26 regulation links (not full 75 backfill). Next expansion: health → performance → comparative → certification.

Deferred: patent, award.

## Commands

```bash
pnpm knowledge:build-evidence-corpus-index
pnpm knowledge:validate-evidence-corpus
pnpm knowledge:evidence-corpus-coverage-report
pnpm knowledge:evidence-corpus-dashboard
pnpm knowledge:evidence-corpus-drift-report
pnpm knowledge:platform-dashboard   # 4 corpora
```

## Related

- [EVIDENCE-GOVERNANCE.md](./EVIDENCE-GOVERNANCE.md)
- [SPRINT-5C-PLAN.md](../sprint-5/SPRINT-5C-PLAN.md)
- [evidence-corpus/README.md](./evidence-corpus/README.md)
