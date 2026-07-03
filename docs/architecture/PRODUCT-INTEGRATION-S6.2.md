# S6.2 Product Integration — Review Result × Knowledge Basis

**Status:** Approved for implementation (prototype phase)  
**Sprint:** 6.2 — Workflow integration  
**Date:** 2026-07-01  
**Related:** [V1-READINESS-REVIEW.md](../releases/V1-READINESS-REVIEW.md) · [KNOWLEDGE-VISIBILITY.md](../knowledge/KNOWLEDGE-VISIBILITY.md) · [KNOWLEDGE-FEEDBACK-LOOP.md](../knowledge/KNOWLEDGE-FEEDBACK-LOOP.md) · [PRD-KNOWLEDGE-COPILOT-V1.md](../product/PRD-KNOWLEDGE-COPILOT-V1.md)

---

## 1. Objective

Transform AAIRP from **separate review and knowledge tools** into a **single product journey**:

```
New Review → Review Result → Knowledge Basis (in context)
```

The legal reviewer sees a compliance **decision** (runtime) and governed **knowledge context** (deterministic preview) on the same screen — without merging the two systems at the code or semantics level.

---

## 2. Product boundary (non-negotiable)

| Layer | Source | User-facing language | Must not |
|-------|--------|----------------------|----------|
| **Review Result** | `POST /demo/review` → review pipeline | PASS / WARN / REJECT, findings, report | — |
| **Knowledge Basis** | `POST /api/knowledge/preview` | “Relevant knowledge found” | “Violation detected”, re-run rules, LLM |

```
┌─────────────────────────────────────────────────────────┐
│  Review Result (runtime)          │  Knowledge Basis      │
│  ─────────────────────            │  ────────────────     │
│  Decision + findings + HTML       │  Preview report       │
│  Rule / Playbook / LLM            │  Skills + linkage     │
│                                   │  Pack stamp           │
└─────────────────────────────────────────────────────────┘
         │                                    │
         └──────── same claim text ───────────┘
              (client passes text only)
```

**No changes** to `ReviewPipelineService`, rule engine, decision engine, or `demo/review` response shape in S6.2 prototype.

---

## 3. Integration architecture

### 3.1 Data flow

```
review-ui (Review Result panel)
    │
    │  claim_text, country, category  (from submitted review context)
    ▼
POST /api/knowledge/preview
    │
    ▼
knowledge-preview.service.ts  (deterministic — existing)
    │
    ▼
KnowledgePreviewReport JSON
    │
    ▼
knowledge-basis.js renders panel + optional feedback
```

### 3.2 What is NOT integrated in S6.2 prototype

| Item | Reason | Target |
|------|--------|--------|
| Finding-level preview | Needs finding text extraction API | S6.2+ |
| Similar cases panel | Uses runtime case retrieval | S6.2 should-have |
| Server-side join of review + preview | Violates service boundary | Never |
| Knowledge Pack load in runtime | Frozen until explicit ADR | Sprint 6+ |
| iframe report → preview bridge | Cross-origin complexity | Client uses same ad text |

### 3.3 Caching

- Client caches preview by `countryId + claim_text_hash` (from preview response)
- Tab switch between SG/MY/TH reuses cache
- New review submission clears cache

---

## 4. UI specification — Knowledge Basis panel

### 4.1 Placement

Inside **Review Workspace → Review Result**, between decision summary and compliance report iframe:

```
[Country tabs]
[Decision card — PASS/REJECT + finding counts]
[Knowledge Basis panel]  ← NEW
[Compliance report iframe]
```

### 4.2 Panel states

| State | UI |
|-------|-----|
| Collapsed default | `<details>` closed on mobile; open on desktop (prototype: open) |
| Loading | “Loading governed knowledge…” |
| Success | Headline, matched skills, linked regulations/evidence (truncated), pack stamp |
| Empty match | “No strongly matched skill knowledge” + link to Explorer |
| Error | API error message; link to standalone `/knowledge/` Preview tab |
| Draft pack | Non-dismissible draft warning (from `draft_warning`) |

### 4.3 Required chrome

1. **Disclaimer** (always visible): preview is not a compliance decision  
2. **Pack stamp**: `knowledge_pack_id` + release status  
3. **Link out**: “Open in Knowledge Explorer” → `/knowledge/?tab=explorer&skill={primary_skill}`  
4. **Feedback**: Yes / Needs update (existing feedback API)

### 4.4 Visual separation

- Knowledge Basis uses **accent border** (blue), not decision colors (green/red)
- Section title: **Knowledge Basis** / 知识依据
- No reuse of `decision-PASS` / `decision-REJECT` classes in knowledge panel

---

## 5. API contract (unchanged)

### Request

```http
POST /api/knowledge/preview
Content-Type: application/json

{
  "claim_text": "<submitted ad text>",
  "country": "SG",
  "category": "electronics"
}
```

### Response

Existing `KnowledgePreviewReport` — includes `claim_text_hash`, `knowledge_pack_fingerprint`, `corpus_fingerprints`, `evaluation_reference` for feedback.

### Feedback

```http
POST /api/knowledge/preview/feedback
```

Body uses fields from preview report (metadata only).

---

## 6. File map (S6.2 prototype)

| File | Change |
|------|--------|
| `apps/review-ui/public/knowledge-basis.js` | **New** — fetch, render, feedback |
| `apps/review-ui/public/app.js` | Store `claimText` per result; mount panel in `renderResults` |
| `apps/review-ui/public/index.html` | `#knowledge-basis-wrap` container |
| `apps/review-ui/public/styles.css` | Knowledge Basis panel styles |
| `docs/product/PRD-KNOWLEDGE-COPILOT-V1.md` | Product requirements |
| `docs/architecture/PRODUCT-INTEGRATION-S6.2.md` | This document |

**No changes** to `packages/application` review services for prototype.

---

## 7. Acceptance criteria (S6.2 prototype)

- [x] After successful review, Knowledge Basis panel appears on Review Result
- [x] Panel calls `/api/knowledge/preview` with submitted claim text + country
- [x] Disclaimer and draft warning shown when applicable
- [x] Decision and knowledge visually separated
- [x] Feedback Yes/Needs update works from review context
- [x] Link to Knowledge Explorer with primary skill pre-selected (when matched)
- [x] No imports from review pipeline added to knowledge-preview.service
- [x] Benchmark regression unchanged (`pnpm eval:benchmark-v3 -- --tier=regression`) — verified 2026-07-01

---

## 8. Future (post-prototype)

| Feature | Sprint |
|---------|--------|
| Per-finding “explain basis” click | S6.2.1 |
| Similar cases from runtime retrieval | S6.2 should-have |
| Unified top nav (Review · Knowledge · Admin) | S6.1/S6.4 |
| Review outcome feedback (separate from preview) | S6.3 |
| Auth on preview API | S6.3 |

---

## 9. ADR reference

This integration implements **ADR-007 Deterministic Preview Boundary** and **ADR-011 Product Shell vs Platform** (knowledge assists review; does not replace it). See [ARCHITECTURE-DECISION-RECORDS.md](./ARCHITECTURE-DECISION-RECORDS.md).
