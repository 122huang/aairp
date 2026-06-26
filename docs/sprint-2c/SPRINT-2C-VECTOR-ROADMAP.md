# Sprint 2C — Case Vector Retrieval

Semantic similar-case retrieval for Case First runtime using **offline deterministic embeddings** and **hybrid ranking**.

## Scope

| Epic | Deliverable | Status |
|------|-------------|--------|
| **E2C-1** | `case_embedding` table + PG repository | ✅ |
| **E2C-2** | Deterministic hash embedding provider (128-dim) | ✅ |
| **E2C-3** | `CaseEmbeddingIndexerService` + CLI | ✅ |
| **E2C-4** | Hybrid retrieval in `CaseRetrievalService` | ✅ |

## Architecture

```
ReviewContext + Rule refs
        ↓
CaseRetrievalService
  1. Facet filter (country/category/platform/hash)
  2. Load embeddings from app.case_embedding
  3. Hybrid score = 0.6·semantic + 0.2·rule_overlap + 0.2·facet
        ↓
CaseReviewContext / Report precedents
```

### Embed text template (deterministic)

Matches [CASE-LIBRARY-ARCHITECTURE](../knowledge/CASE-LIBRARY-ARCHITECTURE.md):

```
country=… category=… platform=… lang=… ad_type=…
content=… ocr=… decision=… rules=… playbooks=…
```

### Storage

- Table: `app.case_embedding` (migration `V2.2.0__case_embedding.sql`)
- Vectors stored as **JSONB float arrays** (portable; pgvector upgrade optional later)
- Model default: `demo-hash-v1` (feature-hashed bag-of-grams, L2-normalized)

## Environment flags

| Variable | Default | Effect |
|----------|---------|--------|
| `AAIRP_CASE_FIRST_ENABLED` | `false` | Required parent flag |
| `AAIRP_CASE_VECTOR_RETRIEVAL` | `false` | Enable hybrid semantic ranking |
| `AAIRP_CASE_EMBEDDING_MODEL` | `demo-hash-v1` | Embedding model id |

## Setup

```powershell
pnpm migrate
pnpm kos:import-cases
pnpm kos:index-case-embeddings

$env:AAIRP_CASE_FIRST_ENABLED='true'
$env:AAIRP_CASE_VECTOR_RETRIEVAL='true'
pnpm dev:api
```

Retrieval strategy in API results becomes `filter+vector+hybrid_v1` (vs `facet+hash_v1` when vector off).

## Regression

With `AAIRP_CASE_VECTOR_RETRIEVAL=false` (default), retrieval remains `facet+hash_v1`.

## Future (optional)

- Swap `DeterministicHashEmbeddingProvider` for OpenAI / local ONNX provider
- Migrate `embedding_json` → `pgvector` column + HNSW index for large libraries

## Evidence

- [E2C completion report](./evidence/e2c-vector-retrieval-report.md)
