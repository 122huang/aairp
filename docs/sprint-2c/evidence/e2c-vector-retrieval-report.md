# E2C — Vector Retrieval Completion Report

**Date:** 2026-06-26  
**Sprint:** 2C  

## Summary

Added **semantic case retrieval** via deterministic offline embeddings and **hybrid ranking**, integrated into the existing Case First pipeline.

## Deliverables

### Database

- `V2.2.0__case_embedding.sql` — `app.case_embedding` (JSONB vectors)

### Shared kernel

- `case-embedding.ts` — embed text builders, cosine similarity, hybrid score, flags
- `ICaseEmbeddingRepository`, `IEmbeddingProvider`, `CaseEmbeddingRecord`

### Application

- `DeterministicHashEmbeddingProvider` — 128-dim feature hashing (no external API)
- `CaseEmbeddingIndexerService` — index latest KOS cases
- `CaseRetrievalService` — hybrid mode: `0.6·semantic + 0.2·rule_overlap + 0.2·facet`

### Infrastructure

- `PgCaseEmbeddingRepository`
- CLI: `pnpm kos:index-case-embeddings`

### API wiring

- `bootstrapReviewRuntime` injects embedding repo + provider into retrieval

## Hybrid score

| Signal | Weight |
|--------|--------|
| Cosine(query, case) | 0.6 |
| Rule ref overlap | 0.2 |
| Facet/hash base score | 0.2 |

## Tests

- `deterministic-hash-embedding.provider.spec.ts`
- `case-retrieval.service.spec.ts` (hybrid path)

## Operational notes

1. Import cases to KOS: `pnpm kos:import-cases`
2. Build embeddings: `pnpm kos:index-case-embeddings`
3. Enable flags: `AAIRP_CASE_FIRST_ENABLED=true`, `AAIRP_CASE_VECTOR_RETRIEVAL=true`

Without step 2, hybrid mode falls back to facet-only scores for cases missing embeddings.
