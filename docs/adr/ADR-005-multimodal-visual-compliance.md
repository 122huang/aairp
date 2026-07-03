# ADR-005: Multimodal Visual Compliance (OCR + Vision)

**Status:** Approved  
**Date:** 2026-07-02  
**Depends on:** ADR-004 (EKS), ADR-001 (Runtime Frozen — **partial extension approved for Decision fuse inputs only**)  
**Supersedes:** Pilot scope statement “long images / banners not in scope” ([PILOT-SCOPE.md](../legal-pilot/PILOT-SCOPE.md) § limitations)

---

## 1. Context

### 1.1 Problem

Advertising compliance for small appliances is **not text-only**. PDP long images, banners, and lifestyle shots carry risk that OCR flattening destroys:

| Signal | OCR | Vision model |
|--------|-----|----------------|
| Exact claim strings for Rule keyword match | ✅ | ⚠️ paraphrase risk |
| Certification badge authenticity / scope | ❌ | ✅ |
| Product panel language vs target market | ⚠️ partial | ✅ |
| Scene props (food, postpartum, medical cues) | ❌ | ✅ |
| Comparison table / before-after **structure** | ❌ | ✅ |
| Cross-page model / capacity / material consistency | ❌ | ✅ (with dedicated pass) |

**OCR answers:** “What characters appear?”  
**Visual compliance answers:** “What does the ad *show*, imply, or structurally claim?”

Both are required. OCR is **not** replaced; it feeds the **text branch** in parallel with vision.

### 1.2 Current runtime (frozen baseline)

```
Context → Rule → Playbook → Open Risk (text) → Decision → Report
```

- `normalizedContent.text` + optional `ocrText` → Rule / Playbook / Open Risk  
- `imageUrls` exist on context; modality rules (`has_images`, `ai_rendered_image`) gate some rules  
- No vision LLM gateway; image benchmark cases use fixtures + manual `ocr_text`

### 1.3 Skill Module H (cross-asset consistency)

Localization / Brand consistency skills require **cross-slice and cross-image** field alignment (model, capacity, material, voltage, language). Single-image review cannot satisfy this without a **second consistency pass**.

---

## 2. Decision Summary

| # | Decision | Status |
|---|----------|--------|
| D1 | **Dual-channel input:** text branch (copy + OCR) ∥ vision branch (images) | **Approved** |
| D2 | **Four verdicts** fused at Decision: `verdict_text`, `verdict_image`, `verdict_consistency`, optional `verdict_open_risk` (existing) | **Approved** |
| D3 | **PDP long images:** semantic segment slicing → per-slice vision review → slice-level findings rollup | **Approved** |
| D4 | **Cross-image consistency:** extract structured fields (pass 1) → dedicated compare prompt (pass 2) | **Approved** |
| D5 | **Confidence gating:** low-confidence vision findings → `MANUAL_REVIEW`; do not escalate `final_verdict` | **Approved** |
| D6 | **REJECT authority:** Rule `BLOCKER` unchanged; vision-only REJECT only at **high confidence** on hard categories (false authority, competitor mark, unreadable mandatory disclosure) | **Approved** |
| D7 | **Language honesty:** TH/MY/ZH/EN — extract faithfully; unreadable regions → `[unreadable@bbox]`; no hallucinated Thai | **Approved** |
| D8 | **Explicit opt-in:** `AAIRP_VISION_MODE=live` (default `off`); pilot may use `stub` fixtures | **Approved** |

---

## 3. Target architecture

### 3.1 Pipeline (extended, not replaced)

```
                    ┌─────────────────────────────────────┐
                    │           ReviewContext              │
                    │  text · ocrText · imageUrls · meta   │
                    └──────────────┬──────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐    ┌──────────────────────┐    ┌────────────────────┐
│  TEXT BRANCH    │    │   VISION BRANCH       │    │ CONSISTENCY BRANCH │
│  (unchanged)    │    │   (new)               │    │ (new, multi-image) │
├─────────────────┤    ├──────────────────────┤    ├────────────────────┤
│ Rule Engine     │    │ Slice planner         │    │ Field extractor    │
│ Playbook Engine │    │ Vision compliance svc │    │ Cross-asset compare│
│ Open Risk text  │    │ per slice             │    │ service            │
└────────┬────────┘    └──────────┬───────────┘    └─────────┬──────────┘
         │                        │                          │
         ▼                        ▼                          ▼
   verdict_text            verdict_image            verdict_consistency
         │                        │                          │
         └────────────────────────┼──────────────────────────┘
                                  ▼
                    ┌─────────────────────────────┐
                    │   DecisionEngine.fuse        │
                    │   max risk + confidence gate │
                    │   + hasBlocker (Rule)        │
                    └─────────────────────────────┘
                                  ▼
                          final_verdict + Report
```

### 3.2 Branch responsibilities

| Branch | Input | Output | Deterministic? |
|--------|-------|--------|----------------|
| **Text** | `text`, `ocrText` | Rule / Playbook / Open Risk findings → `verdict_text` | Rule/Playbook yes; Open Risk LLM |
| **Vision** | `imageUrls[]`, slices | `VisionFinding[]` → `verdict_image` | No (vision LLM); slice plan may be heuristic |
| **Consistency** | extracted fields from all slices | `ConsistencyFinding[]` → `verdict_consistency` | Compare logic + LLM assist |

**OCR role:** populate `ocrText` and optionally append to searchable fields for Rule/Playbook — same as today. Vision does **not** depend on OCR quality for layout/badge/scene tasks.

---

## 4. Image slice schema

### 4.1 Slice types (semantic, not fixed pixels)

| `slice_type` | Typical PDP region | Review focus |
|--------------|-------------------|--------------|
| `hero` |首图 / product hero | Product identity, language on device, AI-render flag |
| `claims` |卖点段 | Quantitative claims, health/medical cues, comparisons |
| `specs` |规格参数 | Model, capacity, voltage, material |
| `certification` |认证 / 质检 | Badge authenticity, scope, readability |
| `lifestyle` |场景 / 人群 | Food, children, postpartum, medical props |
| `comparison` |对比图 / 表格 | Before-after structure, competitor marks |
| `footer` |免责声明 / #ad | Disclosure, legal lines |

### 4.2 `ImageSlice` (shared-kernel)

```typescript
type ImageSliceType =
  | 'hero'
  | 'claims'
  | 'specs'
  | 'certification'
  | 'lifestyle'
  | 'comparison'
  | 'footer'
  | 'unknown';

type ImageSlice = {
  slice_id: string;           // e.g. "img0-s2-claims"
  source_image_index: number; // index in imageUrls
  slice_type: ImageSliceType;
  bbox?: { x: number; y: number; w: number; h: number }; // normalized 0–1
  crop_url?: string;          // optional stored crop for audit
  byte_size?: number;
  planner_hint?: string;      // e.g. "detected_cert_badge_cluster"
};
```

### 4.3 Slice planner (v1)

1. If single image & height/width within model budget → one slice (`hero` or `unknown`).  
2. If long image (height > threshold, e.g. 2× width) → vertical segmenter:  
   - heuristic band detection (whitespace / color blocks), or  
   - fixed max-height windows with **overlap** + merge duplicate findings.  
3. User may supply `slice_manifest` in API for pilot (legal-provided segments).

**Non-goal v1:** pixel-perfect auto segmentation ML. Heuristic + manual manifest is acceptable.

---

## 5. Vision finding schema

```typescript
type VisionSuggestedAction = 'WARN' | 'MANUAL_REVIEW';

type VisionFinding = {
  module: 'VISION';
  findingId: string;
  slice_id: string;
  risk_type: string;          // taxonomy-aligned, e.g. sa-certification-evidence
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'WARN' | 'REVIEW'; // REVIEW = manual queue
  confidence: number;         // 0–1
  suggested_action: VisionSuggestedAction;
  summary: string;
  evaluationDetail: {
    evidenceSpans?: Array<{
      field: 'image' | 'ocr_text';
      slice_id?: string;
      bbox?: { x: number; y: number; w: number; h: number };
      text?: string;
    }>;
    languages_detected?: string[];
    unreadable_regions?: string[];
    related_modules_checked?: string[];
  };
};
```

### 5.1 Confidence thresholds (aligned with Open Risk)

| Confidence | `suggested_action` | Effect on `verdict_image` | Effect on `final_verdict` |
|------------|-------------------|---------------------------|---------------------------|
| `< 0.75` | `MANUAL_REVIEW` | `REVIEW` (manual queue) | **Does not** upgrade PASS→WARN |
| `0.75 – 0.89` | `WARN` | `WARN` | Can upgrade PASS→WARN |
| `≥ 0.90` + hard category¹ | `WARN` or escalate² | `WARN` or `REJECT`² | May REJECT² |

¹ Hard categories: `sa-false-authority-endorsement`, `sa-competitor-trademark`, missing mandatory `#ad` on sponsored visual.  
² Vision-only REJECT requires `confidence ≥ 0.90` **and** policy allow-list — never for subjective health implication.

---

## 6. Consistency pass schema

### 6.1 Extracted fields (pass 1, per slice)

```typescript
type AssetFieldExtract = {
  slice_id: string;
  model_tokens?: string[];
  capacity?: string;
  material?: string;
  voltage?: string;
  languages_on_panel?: string[];
  certification_marks?: string[];
};
```

### 6.2 Consistency finding (pass 2)

```typescript
type ConsistencyFinding = {
  module: 'CONSISTENCY';
  findingId: string;
  field: string;              // e.g. "model_tokens"
  conflict: string;           // human-readable
  slices_involved: string[];
  severity: 'MEDIUM' | 'HIGH';
  decision: 'WARN';
  confidence: number;
};
```

**Trigger:** ≥ 2 slices or ≥ 2 images in request. Skip branch if single slice.

---

## 7. Decision fusion rules

### 7.1 Verdict ordering

```
PASS < WARN < REVIEW (manual) < REJECT
```

### 7.2 Fusion algorithm (v1)

```
1. If Rule hasBlocker → final_verdict = REJECT (unchanged; skip Open Risk; vision findings still attached to report)
2. Else compute branch_verdict ∈ {PASS, WARN, REVIEW} per branch:
   - text: existing DecisionEngine on text findings only
   - image: max(WARN findings) + REVIEW if any MANUAL_REVIEW; REJECT only per §5.1 high-confidence hard category
   - consistency: WARN if any conflict
3. final_verdict = max(branch_verdicts) with REJECT only from step 1 or vision hard category
4. REVIEW-dominant → surface as WARN + manual_queue flag in report (UI shows “待人工”)
```

### 7.3 Report shape

Report must retain **per-branch breakdown**:

```json
{
  "final_decision": "WARN",
  "branch_verdicts": {
    "text": "WARN",
    "image": "REVIEW",
    "consistency": "PASS"
  },
  "findings": { "rule": [], "playbook": [], "llm": [], "vision": [], "consistency": [] }
}
```

---

## 8. Language handling (SG / MY / TH)

| Locale | Guidance |
|--------|----------|
| **ZH** | Extract simplified/traditional as seen; do not normalize to SG/MY preference in finding text |
| **EN** | Primary for SG; flag mixed-language panels under Localization skill |
| **MS** | MY market; same unreadable rules |
| **TH** | Prompt: *“Extract Thai verbatim. If illegible, output `[unreadable@bbox]` — do not guess.”* Default `confidence` cap 0.85 for Thai-dominant slices until benchmark proves otherwise |

---

## 9. Environment & operations

```env
AAIRP_VISION_MODE=off|stub|live     # default off
VISION_LLM_PROVIDER=openai|anthropic|...
VISION_LLM_MODEL=...
VISION_MAX_SLICES_PER_IMAGE=8
VISION_SLICE_MAX_PIXELS=...
VISION_TIMEOUT_MS=60000
AAIRP_OCR_MODE=off|live             # optional parallel OCR service (future)
```

**Knowledge Pack:** vision prompt pack version pinned like `demo-open-risk-1.3.0` → `demo-vision-1.0.0`.

---

## 10. Non-goals (v1)

- Video / GIF / carousel animation review  
- Automated legal conclusion on certification authenticity (human confirm)  
- Replacing Rule engine with end-to-end vision-only review  
- Storing raw user images beyond pilot retention policy  

---

## 11. Consequences

| Positive | Trade-off |
|----------|-----------|
| Catches badge/scene/consistency gaps OCR misses | Higher latency & cost per PDP |
| Clear branch verdicts for legal triage | Slice planner v1 imperfect — manual manifest fallback |
| Confidence gate reduces false REJECT | More MANUAL_REVIEW queue volume |
| Extends Decision without rewriting Rule/Playbook | Requires new benchmark image fixtures |

---

## 12. Revision history

| Date | Change |
|------|--------|
| 2026-07-02 | Initial approval — four-branch model, slice schema, confidence gates |
