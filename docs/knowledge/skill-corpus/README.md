# Skill Corpus

**Corpus type:** `skill`  
**Status:** Sprint 5B-1 — Advertising Review foundation  
**Authoring guide:** [SKILL-CORPUS.md](../SKILL-CORPUS.md)

## Layout

```
skill-corpus/
  schemas/skill-corpus-entry.schema.json
  skill-claim-types.json
  skills/*.json              # one file per atomic skill
  skill-corpus.manifest.json # generated
```

## Commands

```bash
pnpm knowledge:build-skill-corpus-index
pnpm knowledge:validate-skill-corpus
pnpm knowledge:skill-corpus-coverage-report
pnpm knowledge:skill-corpus-dashboard
pnpm knowledge:skill-corpus-drift-report
```

## Notes

- Skill entries define **review capability and execution guidance** — not regulatory decision logic (owned by Rule Corpus).
- `skill-modules.json` remains the legacy eval/linkage consumer; do not delete or migrate in 5B-1.
- Active skills (`validated`, `production`) must link to ≥1 regulation `knowledge_id` unless `regulation_scope: "independent"`.
