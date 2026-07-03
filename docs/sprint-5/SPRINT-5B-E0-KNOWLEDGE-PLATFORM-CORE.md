# Knowledge Platform Core

**Epic:** Sprint 5B-E0 — Knowledge Platform Core  
**Status:** Complete  
**Constraint:** Reporting layer only — no runtime or review pipeline changes

---

## Purpose

Extract shared platform capabilities required by **every** future Knowledge Corpus. Regulation Corpus is the **first plugin implementation**, not the platform itself.

Future Skill, Evidence, Rewrite, and Case corpora register plugins and consume the SDK — they do not duplicate governance logic.

---

## Architecture

```
packages/application/src/knowledge/
├── platform/                    ← Knowledge Platform Core
│   ├── knowledge-entry.ts       Shared KnowledgeEntry base model
│   ├── knowledge-linkage.ts     Shared KnowledgeLinkage model
│   ├── knowledge-lifecycle.ts   Shared lifecycle stages
│   ├── knowledge-classification.ts  Confidence + evidence resolution
│   ├── corpus-sdk.ts            KnowledgeCorpusPlugin interface
│   ├── knowledge-platform.ts    Registry + multi-corpus snapshot
│   └── governance/
│       ├── freshness.ts
│       ├── kqs.ts
│       ├── validator.ts
│       ├── coverage.ts
│       └── dashboard.ts
├── corpus/
│   ├── regulation-corpus.plugin.ts   First SDK implementation
│   └── regulation-entry.adapter.ts   Regulation → linkage adapter
└── regulation-corpus-*.ts       Thin backward-compatible facades
```

---

## Deliverables

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | Shared KnowledgeEntry base | `platform/knowledge-entry.ts` |
| 2 | Shared KnowledgeLinkage | `platform/knowledge-linkage.ts` |
| 3 | Shared governance framework | `platform/governance/*` |
| 4 | Shared lifecycle model | `platform/knowledge-lifecycle.ts` |
| 5 | Shared Corpus SDK | `platform/corpus-sdk.ts` + `corpus/regulation-corpus.plugin.ts` |

---

## KnowledgeCorpusPlugin contract

Each corpus implements:

- `load()` — entries + root path
- `getEntryKey()` / `getLinkage()`
- `kqsDimensions` — corpus-specific KQS scorers + shared classification dimensions
- `buildCoverage()` / `buildManifest()` / `validate()`
- Reporting titles and manifest filename

Register via `registerCorpusPlugin()` in `knowledge-platform.ts`.

---

## Commands

```bash
# Regulation (facade — uses platform SDK)
pnpm knowledge:build-regulation-corpus-index
pnpm knowledge:regulation-coverage-report
pnpm knowledge:validate-regulation-corpus
pnpm knowledge:regulation-dashboard

# Multi-corpus platform snapshot
pnpm knowledge:platform-dashboard
```

---

## Backward compatibility

Existing regulation CLI commands and report shapes are preserved via thin facades in `regulation-corpus-*.ts`. Internal implementation delegates to the platform SDK.

---

## Next (5B+)

- Skill / Evidence / Rewrite / Case corpus plugins
- Promote `confidence_level` and `evidence_requirement` from tags to on-disk schema
- Unified linkage validator across platform + runtime IDs
- E6 Knowledge Pack fingerprint hook
