# Rewrite Corpus

**Corpus type:** `rewrite`  
**Status:** Sprint 5B-2  
**Authoring guide:** [REWRITE-CORPUS.md](../REWRITE-CORPUS.md)

## Layout

```
rewrite-corpus/
  schemas/rewrite-corpus-entry.schema.json
  rewrite-strategies.json
  rewrites/*.json
  rewrite-corpus.manifest.json   # generated
```

## Commands

```bash
pnpm knowledge:build-rewrite-corpus-index
pnpm knowledge:validate-rewrite-corpus
pnpm knowledge:rewrite-corpus-coverage-report
pnpm knowledge:rewrite-corpus-dashboard
pnpm knowledge:rewrite-corpus-drift-report
```

## Notes

- Rewrite entries are **knowledge guidance** — not a rewrite engine, LLM prompts, or generated text.
- `rewrite-templates.json` remains the eval consumer; do not delete in 5B-2.
- `benchmark_refs` hold benchmark-v3 `case_id` values; `case_refs` reserved for Case Corpus (`case:…`).
- Formal `linkage.evidence` starts in Sprint 5C; use `evidence_requirement` + `expected_evidence_type` until then.
