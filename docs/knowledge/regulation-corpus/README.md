# Regulation Corpus

Versioned **Regulation Corpus** source files for AAIRP. This is the first subtype of the [Knowledge Corpus](../KNOWLEDGE-ROADMAP.md).

**Authoring guide:** [REGULATION-CORPUS.md](../REGULATION-CORPUS.md)  
**Shared authoring standard:** [KNOWLEDGE-AUTHORING-STANDARD.md](../KNOWLEDGE-AUTHORING-STANDARD.md)

## Layout

```
regulation-corpus/
├── regulation-categories.json   # 12 claim categories
├── countries.json               # 7 APAC markets
├── schemas/                     # JSON Schema (envelope + entry)
└── regulations/
    ├── SG/
    ├── MY/
    ├── TH/
    ├── ID/
    ├── JP/
    ├── KR/
    └── AU/
```

## Loader

TypeScript loaders live in `packages/application/src/knowledge/regulation-corpus.ts`.

Override the corpus root with `AAIRP_REGULATION_CORPUS_PATH`.

## Generated artifacts (E3+)

- `regulation-corpus.manifest.json` — generated index
- Coverage report — `pnpm knowledge:regulation-coverage-report`

## Runtime

The Regulation Corpus does **not** feed the live review pipeline in Sprint 5A. Demo regulation seeds and `demo/rules.demo.json` remain unchanged.
