# Evidence Corpus

Substantiation knowledge for the Knowledge Platform — evidence requirements, types, validation criteria, and cross-corpus linkage.

**Not a document repository.** Entries define what substantiation applies and how reviewers validate it; documents live outside git (KOS / compliance DMS).

## Layout

```
evidence-corpus/
  evidence-types.json          # Type taxonomy + expected_evidence_type resolution
  schemas/
    evidence-corpus-entry.schema.json
  evidence/
    *.json                       # One file per evidence requirement entry
  evidence-corpus.manifest.json  # Generated index
```

## Model

| Concept | Field | Notes |
|---------|-------|-------|
| Evidence type | `evidence_type_key` | Taxonomy key (certification, lab_report, …) |
| Evidence requirement | `requirement_scope` + `evidence_purpose_tags` | Claim-class scope without jurisdiction |
| Jurisdiction | `applicability.countries` | Not encoded in `evidence_id` |

## Commands

```bash
pnpm knowledge:build-evidence-corpus-index
pnpm knowledge:validate-evidence-corpus
pnpm knowledge:evidence-corpus-coverage-report
pnpm knowledge:evidence-corpus-dashboard
pnpm knowledge:evidence-corpus-drift-report
```

See [EVIDENCE-CORPUS.md](../EVIDENCE-CORPUS.md) for authoring guidance.
