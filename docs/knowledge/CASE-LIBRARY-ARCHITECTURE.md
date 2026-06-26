# Case Library Architecture

**Role:** Knowledge Engineer design artifact  
**Status:** Design (Phase 0 — no runtime changes to Happy Path)  
**Version:** 1.0.0  
**Date:** 2026-06-26

---

## 1. Purpose

**Case Library** 将每一次广告审核的完整上下文与结论沉淀为 **可检索、可复用、可审计** 的结构化案例（Case），供后续：

- 合规人工复核与标注（Human Feedback）
- 相似案例检索（Similar Case Retrieval）
- Pilot / 评估基准扩展
- Sprint 2B+ 的 RAG、Playbook 增强、规则调优

### Design principles

| # | Principle |
|---|-----------|
| P1 | **不修改审核逻辑** — Case 由审核结果 **旁路生成**（Observer / Recorder），不参与 Decision 计算 |
| P2 | **不新增业务功能（本阶段）** — 本文档仅定义 Schema、生命周期、存储与检索策略；实现归属 Sprint 2A E4 / 独立 Epic |
| P3 | **兼容 Sprint 1 MVP** — Case 字段映射自现有 `ReviewContext`、`RuleFinding`、`PlaybookFinding`、`LlmFinding`、`ReviewDecisionResult` |
| P4 | **Immutable snapshot** — 自动生成 Case 为只读快照；人工修正通过 `human_decision` + `feedback` 关联，不 retroactive 改 AI 输出 |
| P5 | **Progressive storage** — JSON → PostgreSQL → Vector DB 三阶段，Schema 保持一致 |

---

## 2. System position

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Sprint 1 Happy Path (UNCHANGED)                                         │
│  Advertisement → Context → Rule → Playbook → LLM → Decision → Report    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ ReviewCompletedEvent (async, side-effect)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Case Library (NEW — sidecar, non-blocking)                              │
│  CaseBuilder → CaseValidator → CaseStore → CaseIndex → CaseSearch API   │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                     Human Feedback (optional, async)
                                │
                                ▼
                     Case enrichment / confirmation
```

**Integration point (future, not in scope of this design doc implementation):**

- Hook location: **API controller boundary** or **dedicated `CaseRecorderService`** after `ReviewHappyPathService.run()` returns
- Feature flag: `AAIRP_CASE_LIBRARY_ENABLED=false` (default off until Phase 1 infra ready)
- Failure policy: Case 写入失败 **不得** 影响 `/demo/review` HTTP 200

---

## 3. Case Schema

### 3.1 Root object

```json
{
  "schema_version": "1.0.0",
  "case_id": "case_019abc…",
  "review_id": "rev_…",
  "advertisement_id": "ad_…",
  "lifecycle_status": "GENERATED",
  "dimensions": { },
  "advertisement": { },
  "context_builder_output": { },
  "matched_rules": [ ],
  "matched_playbooks": [ ],
  "llm_analysis": { },
  "decision": { },
  "evidence": [ ],
  "recommendation": { },
  "human_feedback": null,
  "reference_regulations": [ ],
  "metadata": { },
  "created_at": "2026-06-26T10:00:00.000Z",
  "updated_at": "2026-06-26T10:00:00.000Z"
}
```

### 3.2 Field mapping (20 required fields)

| # | Field | JSON path | Type | Source (Sprint 1) |
|---|-------|-----------|------|-------------------|
| 1 | **Case ID** | `case_id` | `string` | New UUID; stable forever |
| 2 | **Country** | `dimensions.country_id` | `string` | `ReviewContext.dimensions.countryId` |
| 3 | **Language** | `advertisement.content.language` | `string?` | `NormalizedContent.language` or detected |
| 4 | **Platform** | `dimensions.platform_id` | `string` | `ReviewContext.dimensions.platformId` |
| 5 | **Category** | `dimensions.category_id` | `string` | `ReviewContext.dimensions.categoryId` |
| 6 | **Advertisement Type** | `advertisement.ad_type` | `string` | `advertisementContext.adFormat` / `campaignType` / enum |
| 7 | **Advertisement Content** | `advertisement.content` | `object` | `NormalizedContent` (text, images, landingUrl) |
| 8 | **OCR Result** | `advertisement.content.ocr_text` | `string?` | `NormalizedContent.ocrText` |
| 9 | **Context Builder Output** | `context_builder_output` | `object` | Full `ReviewContext` snapshot (minus secrets) |
| 10 | **Matched Rule** | `matched_rules[]` | `array` | `RuleEvaluationResult.findings` |
| 11 | **Matched Playbook** | `matched_playbooks[]` | `array` | `PlaybookEvaluationResult.findings` |
| 12 | **LLM Analysis** | `llm_analysis` | `object` | `OpenRiskDiscoveryResult` (findings, skipped, prompt version) |
| 13 | **Decision** | `decision.ai_decision` | `PASS\|WARN\|REJECT` | `ReviewDecisionResult.finalDecision` |
| 14 | **Confidence** | `decision.confidence` | `number` | `ReviewDecisionResult.confidence` (0–1) |
| 15 | **Evidence** | `evidence[]` | `array` | Aggregated spans + citations from all findings |
| 16 | **Recommendation** | `recommendation` | `object` | Derived from rationale + top findings + suggested actions |
| 17 | **Human Decision** | `human_feedback.decision` | `PASS\|WARN\|REJECT\|null` | Post-review feedback; null until human acts |
| 18 | **Final Decision** | `decision.final_decision` | `PASS\|WARN\|REJECT` | `human_feedback.decision ?? ai_decision` |
| 19 | **Reference Regulation** | `reference_regulations[]` | `array` | Rule finding `citation` + playbook refs |
| 20 | **Created Time** | `created_at` | `ISO8601` | Case generation timestamp |

### 3.3 Detailed sub-schemas

#### `dimensions`

```json
{
  "tenant_id": "demo",
  "country_id": "SG",
  "platform_id": "SHOPEE",
  "category_id": "health.supplement"
}
```

#### `advertisement`

```json
{
  "advertisement_id": "ad_…",
  "content_hash": "sha256:…",
  "content_version": 1,
  "ad_type": "PRODUCT_LISTING",
  "content": {
    "text": "Daily vitamins for general wellness. #ad",
    "ocr_text": null,
    "language": "en",
    "image_urls": [],
    "landing_url": null
  },
  "tags": ["pilot:manual"]
}
```

**`ad_type` enum (extensible):** `PRODUCT_LISTING` | `SOCIAL_POST` | `VIDEO_AD` | `SEARCH_AD` | `LIVE_STREAM` | `UNKNOWN`

#### `context_builder_output`

Snapshot of `ReviewContext` at review time:

```json
{
  "review_id": "rev_…",
  "content_hash": "…",
  "content_version": 1,
  "normalized_content": { "text": "…", "ocrText": "…", "imageUrls": [] },
  "resolved_knowledge_versions": {
    "rule_pack_version": "demo-rule-1.0.0",
    "policy_pack_version": "demo-policy-1.0.0",
    "playbook_pack_version": "demo-playbook-1.0.0"
  },
  "advertisement_context": {
    "campaignType": "…",
    "adFormat": "…",
    "targetAudience": "…"
  },
  "tags": [],
  "built_at": "2026-06-26T10:00:00.000Z"
}
```

#### `matched_rules[]` / `matched_playbooks[]`

Aligned with `RuleFinding` / `PlaybookFinding`:

```json
{
  "finding_id": "rf_…",
  "ref_id": "demo-sg-health-forbidden-claim",
  "ref_version_id": "demo-sg-health-forbidden-claim-v1",
  "severity": "BLOCKER",
  "decision": "FAIL",
  "summary": "Prohibited absolute health cure claims are not allowed",
  "confidence": 1.0,
  "evaluation_detail": {
    "matched_spans": [{ "field": "text", "start": 20, "end": 24, "text": "cure" }],
    "citation": {
      "law_name": "SG Health Products Act (Demo)",
      "article": "Section 7 — Prohibited claims"
    }
  }
}
```

#### `llm_analysis`

```json
{
  "prompt_pack_version": "demo-open-risk-1.1.0",
  "skipped": false,
  "skip_reason": null,
  "findings": [
    {
      "finding_id": "lf_…",
      "ref_id": "unsubstantiated_claim",
      "severity": "MEDIUM",
      "decision": "WARN",
      "summary": "…",
      "confidence": 0.82,
      "evaluation_detail": {
        "risk_type": "unsubstantiated_claim",
        "suggested_action": "ADD_DISCLOSURE",
        "evidence_spans": []
      }
    }
  ],
  "evaluated_at": "2026-06-26T10:00:01.000Z"
}
```

When `prior.hasBlocker === true`: `skipped: true`, `skip_reason: "HAS_BLOCKER"`, `findings: []`.

#### `decision`

```json
{
  "ai_decision": "REJECT",
  "confidence": 0.95,
  "rationale": "Rule BLOCKER: demo-sg-health-forbidden-claim (BLOCKER); …",
  "finding_counts": { "rule": 1, "playbook": 2, "llm": 0 },
  "decided_at": "2026-06-26T10:00:02.000Z",
  "final_decision": "REJECT"
}
```

`final_decision` recomputed when human feedback arrives.

#### `evidence[]`

Normalized evidence layer (cross-module):

```json
{
  "evidence_id": "ev_…",
  "source_module": "RULE",
  "source_ref_id": "demo-sg-health-forbidden-claim",
  "evidence_type": "TEXT_SPAN",
  "field": "text",
  "start": 20,
  "end": 24,
  "text": "cure",
  "regulation_ref": "SG Health Products Act (Demo) §7"
}
```

#### `recommendation`

```json
{
  "summary": "Remove prohibited cure claim; add substantiation or reword superlative.",
  "actions": [
    { "priority": 1, "action": "REMOVE_CLAIM", "target": "text", "detail": "Remove 'cure'" },
    { "priority": 2, "action": "ADD_DISCLOSURE", "target": "text", "detail": "Add #ad or sponsored" }
  ],
  "derived_from": ["matched_rules", "matched_playbooks", "decision.rationale"]
}
```

#### `human_feedback` (nullable until provided)

```json
{
  "decision": "REJECT",
  "reviewer_id": "compliance.user@corp",
  "reviewer_role": "COMPLIANCE",
  "comment": "Correct BLOCKER; also flag missing HSA disclaimer.",
  "submitted_at": "2026-06-26T11:00:00.000Z",
  "pilot_id": "P-002",
  "agreement_with_ai": "AGREE"
}
```

#### `reference_regulations[]`

Deduped from rule citations + playbook guidance:

```json
{
  "law_name": "SG Health Products Act (Demo)",
  "article": "Section 7 — Prohibited claims",
  "jurisdiction": "SG",
  "source_module": "RULE",
  "source_ref_id": "demo-sg-health-forbidden-claim"
}
```

#### `metadata`

```json
{
  "source": "demo/review",
  "pipeline_version": "0.1.0-sprint1.5",
  "open_risk_skipped": true,
  "storage_phase": "json",
  "embedding_id": null,
  "similar_case_ids": []
}
```

### 3.4 Lifecycle status enum

| Status | Meaning |
|--------|---------|
| `GENERATED` | Auto-created after review; no human input |
| `PENDING_HUMAN` | Queued for compliance review |
| `CONFIRMED` | Human feedback recorded; `final_decision` locked |
| `DISPUTED` | Human disagrees with AI (`agreement_with_ai: DISAGREE`) |
| `ARCHIVED` | Retired from active retrieval; kept for audit |
| `SUPERSEDED` | Replaced by newer case for same content hash |

---

## 4. Case Lifecycle

```
Advertisement
     │
     ▼
  Review ──────────────────────────────────────────────┐
     │   (Happy Path: Context→Rule→Playbook→LLM→        │
     │    Decision→Report — UNCHANGED)                  │
     ▼                                                  │
 Decision ◄─────────────────────────────────────────────┘
     │
     │  ReviewCompletedEvent (async)
     ▼
 Generate Case ─── CaseBuilder maps pipeline output → Case Schema
     │
     ▼
   Store ───────── Phase 1: JSON file
     │            Phase 2: PostgreSQL `app.case` + child tables
     │            Phase 3: + vector index
     ▼
 Human Feedback (optional, async)
     │  Updates: human_feedback, final_decision, lifecycle_status
     ▼
 Search ◄──────── Admin / future retrieval API
     │
     ▼
 Reuse ────────── Similar cases in report appendix, RAG context, eval dataset
```

### 4.1 Stage definitions

| Stage | Trigger | Output | Modifies review? |
|-------|---------|--------|------------------|
| **Advertisement** | `POST /demo/advertisements` or upload step in `/demo/review` | `NormalizedAdvertisement` | No |
| **Review** | Pipeline execution | Findings + timings | No |
| **Decision** | `DecisionEngineService.fuseFromFindings` | `ReviewDecisionResult` | No |
| **Human Feedback** | Compliance submits feedback form / API | `human_feedback` block | No — only Case |
| **Generate Case** | Recorder on success response | `Case` object | No |
| **Store** | CaseStore adapter | Persistent record | No |
| **Search** | Query by dimensions + similarity | Ranked `case_id[]` | No |
| **Reuse** | Retrieval injected into **future** advisory layer | Hints / references | **Not in Sprint 1** — read-only display first |

### 4.2 Decision precedence

```
final_decision = human_feedback.decision ?? decision.ai_decision
```

| Scenario | ai_decision | human_decision | final_decision | lifecycle_status |
|----------|-------------|----------------|----------------|------------------|
| Auto only | WARN | null | WARN | GENERATED |
| Human agrees | PASS | PASS | PASS | CONFIRMED |
| Human overrides | PASS | WARN | WARN | CONFIRMED |
| Human disputes | PASS | REJECT | REJECT | DISPUTED |

---

## 5. Case Folder Structure

### Phase 1 — JSON (Sprint 2A / Case Library v1)

**Goal:** Zero migration friction; git-friendly samples; Pilot import.

```
case-library/
  schema/
    case.schema.json              # JSON Schema for validation
    case.schema.version           # 1.0.0
  index/
    manifest.json                 # catalog: case_id, path, dimensions, created_at
    by-dimension/
      SG/
        health.supplement/
          SHOPEE/
            index.json            # case_ids + summary facets
  cases/
    {yyyy}/
      {mm}/
        {case_id}.json            # one file per case (immutable)
  imports/
    pilot/                        # optional bulk import from pilot-ad-log.csv
  embeddings/                     # reserved; empty in Phase 1
    .gitkeep
```

**`manifest.json` entry example:**

```json
{
  "case_id": "case_019abc",
  "path": "cases/2026/06/case_019abc.json",
  "country_id": "SG",
  "category_id": "health.supplement",
  "platform_id": "SHOPEE",
  "language": "en",
  "ai_decision": "REJECT",
  "final_decision": "REJECT",
  "lifecycle_status": "GENERATED",
  "content_hash": "sha256:…",
  "created_at": "2026-06-26T10:00:00.000Z"
}
```

**Write rules:**

- One review → one case file (1:1 on `review_id`)
- File write is **append-only**; updates create new file version or patch `human_feedback` in place with `updated_at`
- Duplicate `content_hash` + same knowledge versions → link via `metadata.supersedes_case_id` instead of overwrite

---

### Phase 2 — Database (Sprint 2A E4 alignment)

**Goal:** Query, pagination, Pilot feedback linkage, Audit.

```
PostgreSQL app schema:

  case_record              -- root (case_id PK)
  case_dimension           -- denormalized facets for filter
  case_content             -- advertisement snapshot (JSONB)
  case_context             -- context_builder_output (JSONB)
  case_finding             -- rules + playbooks + llm (typed rows)
  case_evidence            -- normalized evidence
  case_decision            -- ai + final + confidence
  case_recommendation      -- JSONB
  case_human_feedback      -- 0..1 per case
  case_regulation_ref      -- M:N regulation references

  case_record.review_id UNIQUE → links to review_run (Sprint 2A E4)
```

**Migration:** `V2.1.0__case_library.sql` (separate from knowledge pack tables in 2A E0).

**JSON → DB:** One-time `pnpm migrate:cases --from case-library/cases`

---

### Phase 3 — Vector Database (Sprint 2B+)

**Goal:** Semantic similar-case retrieval.

```
case-library/
  embeddings/
    {embedding_model_id}/
      {case_id}.json          # { vector: float[], model, dims, text_source }

Vector store (pgvector or dedicated):

  case_embedding (
    case_id,
    embedding_model,
    embedding vector(1536),
    embed_text,               -- concatenation used for embedding
    created_at
  )
```

**Embed text template (deterministic):**

```
country={country_id} category={category_id} platform={platform_id}
lang={language}
ad_type={ad_type}
content={text}
ocr={ocr_text}
decision={ai_decision}
rules={matched_rule_ref_ids joined}
playbooks={matched_playbook_ref_ids joined}
```

**Dual-write:** Phase 2 insert → async embed job → Phase 3 index (eventual consistency).

---

## 6. Case Retrieval Strategy

### 6.1 Query context (at review or search time)

When a new ad enters review, build **Retrieval Query**:

```json
{
  "country_id": "SG",
  "category_id": "health.supplement",
  "platform_id": "SHOPEE",
  "language": "en",
  "ad_type": "PRODUCT_LISTING",
  "content_text": "Clinically proven to boost immunity…",
  "ocr_text": null,
  "top_k": 5
}
```

### 6.2 Multi-stage retrieval pipeline

```
Stage 1 — Hard filter (must match)
    country_id = SG
    category_id = health.supplement
    platform_id IN (SHOPEE, META, *)     ← platform fallback: exact → ANY

Stage 2 — Soft filter (boost score)
    language match
    ad_type match
    lifecycle_status IN (CONFIRMED, GENERATED)
    exclude ARCHIVED, SUPERSEDED

Stage 3 — Semantic similarity (Phase 3 only)
    cosine(embedding(query), embedding(case)) ≥ threshold

Stage 4 — Outcome affinity (optional boost)
    prefer cases with same matched rule ref_ids
    prefer DISPUTED cases when training eval

Stage 5 — Rank & return top_k
```

### 6.3 Example: Health Supplement · Singapore · Shopee

**Input ad:** SG health supplement product listing on Shopee, text contains `"cure diabetes"`.

| Step | Action | Result |
|------|--------|--------|
| 1 | Filter `country=SG`, `category=health.supplement` | Pool ≈ N cases |
| 2 | Filter `platform=SHOPEE`; if &lt; 3 hits, expand to `platform=*` | Pool ≈ M cases |
| 3 | Keyword pre-filter: shared terms `cure`, `diabetes`, `clinical` | Subset |
| 4 | (Phase 3) Vector similarity on embed_text | Ranked list |
| 5 | Boost cases where `matched_rules[].ref_id = demo-sg-health-forbidden-claim` | Top match |
| **Top case** | Prior REJECT case with same rule BLOCKER + similar span | Reuse in report appendix |

**Expected reuse output (read-only advisory):**

```json
{
  "similar_cases": [
    {
      "case_id": "case_019xyz",
      "similarity_score": 0.91,
      "final_decision": "REJECT",
      "matched_rules": ["demo-sg-health-forbidden-claim"],
      "recommendation_summary": "Remove prohibited cure claim",
      "reference_regulations": ["SG Health Products Act (Demo) §7"]
    }
  ],
  "retrieval_strategy": "filter+vector+v1",
  "note": "Advisory only — does not affect decision fusion"
}
```

### 6.4 Retrieval modes

| Mode | Phase | Use case |
|------|-------|----------|
| **Facet search** | 1 | Admin browse by country/category/platform |
| **Content hash lookup** | 1 | Exact duplicate ad detection |
| **SQL filter + full-text** | 2 | Compliance search by keyword / rule ref |
| **Vector k-NN** | 3 | "Find most similar historical decision" |
| **Hybrid** | 3 | `score = 0.6 * semantic + 0.2 * rule_overlap + 0.2 * recency` |

### 6.5 Non-goals (retrieval)

- Retrieval results **must not** auto-change `final_decision` in Sprint 1–2A
- No auto-learning from DISPUTED cases without explicit Sprint 2B governance

---

## 7. Component architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Case Library System                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────┐    │
│  │ CaseBuilder │───►│ CaseValidator│───►│ CaseStore (adapter)      │    │
│  │             │    │ (JSON Schema)│    │  ├─ JsonCaseStore (P1)   │    │
│  │ Maps:       │    └──────────────┘    │  ├─ PgCaseStore (P2)     │    │
│  │ HappyPath   │                        │  └─ VectorIndex (P3)     │    │
│  │ Result +    │                        └───────────┬─────────────┘    │
│  │ pipeline    │                                    │                   │
│  │ internals   │    ┌──────────────┐                │                   │
│  └─────────────┘    │ CaseIndexer  │◄───────────────┘                   │
│         ▲           │ (manifest)   │                                    │
│         │           └──────────────┘                                    │
│  ReviewCompletedEvent                                                   │
│         │           ┌──────────────┐    ┌─────────────────────────┐    │
│         │           │ CaseSearch   │◄───│ CaseRetrievalEngine      │    │
│         │           │ Service      │    │  filter → rank → top_k   │    │
│         │           └──────┬───────┘    └─────────────────────────┘    │
│                            │                                              │
│  ┌─────────────┐           │           ┌─────────────────────────┐        │
│  │ Human       │───────────┼──────────►│ Admin API (future)       │        │
│  │ Feedback    │           │           │ GET /admin/cases         │        │
│  │ Ingest      │           │           │ GET /admin/cases/search  │        │
│  └─────────────┘           │           │ POST …/feedback          │        │
│                            │           └─────────────────────────┘        │
└────────────────────────────┴──────────────────────────────────────────────┘
```

### 7.1 Component responsibilities

| Component | Responsibility |
|-----------|----------------|
| **CaseBuilder** | Pure function: `(ReviewHappyPathResult, pipelineEval) → Case` |
| **CaseValidator** | JSON Schema validation; required field checks |
| **CaseStore** | Persistence adapter interface; phase-specific impl |
| **CaseIndexer** | Maintains `manifest.json` + dimension indexes |
| **CaseSearchService** | Facet + full-text queries |
| **CaseRetrievalEngine** | Similarity ranking; Phase 3 embeddings |
| **HumanFeedbackIngest** | Patches `human_feedback`, recomputes `final_decision` |

### 7.2 Package placement (future implementation map)

| Layer | Package | Artifact |
|-------|---------|----------|
| Domain | `@aairp/domain` | `Case`, `CaseEvidence`, ports |
| Application | `@aairp/application` | `CaseBuilderService`, `CaseSearchService` |
| Infrastructure | `@aairp/infrastructure` | `JsonCaseStore`, `PgCaseStore`, `PgVectorCaseIndex` |
| API | `apps/api` | `/admin/cases/*` (Sprint 2A+ extension, not `/demo/*`) |

### 7.3 Alignment with Sprint 2A

| Sprint 2A Epic | Case Library relationship |
|----------------|---------------------------|
| E4 Review History | `review_run` is **source event**; Case is **enriched snapshot** |
| E5 Feedback | `human_feedback` shares same ingest path |
| E6 Audit Log | Case create / feedback update audited |
| E1–E3 Knowledge | Case stores **version refs** at review time, not live knowledge |

---

## 8. Auto-generation rules

Every completed review **must** produce exactly one Case when Case Library is enabled:

| Condition | Case generated? |
|-----------|-----------------|
| `POST /demo/review` → 200 | Yes |
| `POST /demo/review` → 400 | No |
| Pipeline throws | No |
| Duplicate `review_id` | Idempotent skip |

**CaseBuilder input bundle (read-only):**

```
ReviewHappyPathResult
  + RuleEvaluationResult      (from pipeline, not re-evaluated)
  + PlaybookEvaluationResult
  + OpenRiskDiscoveryResult
  + ReviewContext             (from context builder)
```

---

## 9. Security & compliance

| Topic | Policy |
|-------|--------|
| PII | Truncate ad text in logs; full text only in secured Case store |
| Retention | Align with `audit-policy.md` (365d default) |
| Immutability | AI findings immutable; human layer additive |
| Access | Admin API internal network only (same as Sprint 1 `/demo/*`) |
| Export | Case JSON export for Pilot / legal hold |

---

## 10. Implementation roadmap (reference only — not Sprint 2A scope creep)

| Phase | Deliverable | Touches Happy Path? |
|-------|-------------|---------------------|
| **P0** | This architecture doc + `case.schema.json` | No |
| **P1** | `CaseBuilder` + JSON store + manifest index | Recorder hook only (flag off) |
| **P2** | PG tables + Admin search API | No |
| **P3** | Embeddings + similarity API | No |
| **P4** | Report appendix "Similar cases" (display only) | No decision change |

---

## 11. Appendix A — Minimal case example

See: `case-library/examples/sg-health-reject-cure.case.json` (to be added when Phase 1 starts).

---

## 12. Appendix B — JSON Schema reference

Formal schema file: `case-library/schema/case.schema.json` (to be generated from §3 in Phase P0).

---

**Document owner:** Knowledge Engineer  
**Next review:** After Internal Pilot Report + Sprint 2A E4 design lock
