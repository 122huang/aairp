# Sprint 6A — Multimodal Visual Compliance

**Status:** Planned  
**Theme:** OCR ∥ Vision dual-channel review + slice-based PDP + cross-asset consistency  
**ADR:** [ADR-005-multimodal-visual-compliance.md](../adr/ADR-005-multimodal-visual-compliance.md)  
**Precedent:** Sprint 5G (feedback loop closed); text pipeline `demo-rule-1.6.11` / Open Risk live

---

## Constraints

| Constraint | Implication |
|------------|-------------|
| Rule / Playbook matching **unchanged** | Text branch behavior frozen; no new rule types required for v1 |
| Open Risk text prompt **unchanged** in 6A | Vision uses separate prompt pack |
| Vision **opt-in** | `AAIRP_VISION_MODE=off` default; pilot uses stub fixtures |
| Knowledge Pack boundary | `demo-vision-1.0.0` prompt + stub versioned in pack manifest |
| No raw image persistence (pilot) | Process in-memory / temp URL only unless legal approves storage |

---

## Sprint goal

Deliver an **end-to-end image review path** for PDP/banner assets:

1. Slice long images semantically  
2. Run vision compliance per slice  
3. Run cross-slice consistency when multi-slice  
4. Fuse with existing text verdict → report with branch breakdown  

**Success:** ≥ 5 image benchmark cases pass; 1 long-image PDP fixture sliced ≥ 3 segments; manual queue for low-confidence findings.

---

## Work packages

### 6A-1 — Schema & ADR lock-in ✅

| Task | Output | Owner |
|------|--------|-------|
| ADR-005 approved | `docs/adr/ADR-005-multimodal-visual-compliance.md` | Arch |
| Shared-kernel types | `ImageSlice`, `VisionFinding`, `ConsistencyFinding`, `BranchVerdicts` | Eng |
| Report extension | `review-report` includes `branch_verdicts`, `vision[]`, `consistency[]` | Eng |

**Exit:** Types compile; report schema backward-compatible (new fields optional).

---

### 6A-2 — Slice planner (v1)

| Task | Output |
|------|--------|
| `ImageSlicePlannerService` | Input: `imageUrl`, dimensions; output: `ImageSlice[]` |
| Long-image heuristic | Height > 2× width → vertical bands (max 8 slices, 10% overlap) |
| Manual manifest API | `content.slice_manifest?: ImageSlice[]` bypasses planner |
| Unit tests | Single image → 1 slice; synthetic long image → N slices |

**Exit:** Planner tests pass; no external API calls in planner.

---

### 6A-3 — Vision compliance gateway

| Task | Output |
|------|--------|
| `demo/vision.prompt.txt` v1.0.0 | Taxonomy-aligned; badge/scene/cert/comparison modules |
| `demo/vision.stub.json` | Fixture responses for 3 benchmark images |
| `VisionComplianceService` | Per-slice `discover(slice, context)` → `VisionFinding[]` |
| `VisionLlmGateway` | Mirror Open Risk pattern: `AAIRP_VISION_MODE`, provider keys |
| Parser + guardrails | JSON parse, bbox grounding, confidence → `MANUAL_REVIEW` |

**Prompt must include (ADR §8):**

- Thai extract-or-`[unreadable@bbox]` instruction  
- Never invent certification body names  
- Output `confidence` on every finding  

**Exit:** Stub mode 3/3 fixture cases return expected risk types; live mode behind env flag.

---

### 6A-4 — Consistency pass

| Task | Output |
|------|--------|
| `FieldExtractService` | Pass 1: model, capacity, material, voltage, languages, certs per slice |
| `ConsistencyCompareService` | Pass 2: diff fields across slices → `ConsistencyFinding[]` |
| `demo/consistency.prompt.txt` | Compare-only prompt (fields in, conflicts out) |
| Skip when single slice | Branch omitted from fuse |

**Exit:** Benchmark case `AF-001`-style localization conflict detected across 2 slices (fixture).

---

### 6A-5 — Decision fusion extension

| Task | Output |
|------|--------|
| `DecisionEngineService.fuseMultimodal()` | Inputs: text fusion result + vision + consistency |
| `hasBlocker` precedence | Rule BLOCKER → REJECT; vision never overrides downward |
| Confidence gate | `< 0.75` vision → manual queue only |
| `ReviewPipelineService` orchestration | Text branch parallel with vision when `imageUrls.length > 0` |

**Exit:** Unit tests for fusion matrix (text PASS + image WARN → WARN; text PASS + image REVIEW-only → PASS + manual flag).

---

### 6A-6 — API & report UI

| Task | Output |
|------|--------|
| `POST /demo/review` | Accept `images[]`, optional `slice_manifest`, `ocr_text` |
| Report sections | Branch verdict chips: 文案 / 图片 / 一致性 |
| Finding cards | Slice thumbnail + bbox highlight (if crop available) |
| Mode indicator | `vision: off | stub | live` in response metadata |

**Exit:** Legal pilot can submit 1 PDP URL + copy; report shows three branch verdicts.

---

### 6A-7 — Benchmark & regression

| Task | Output |
|------|--------|
| `benchmark/image-compliance-v1.json` | ≥ 8 cases: cert unreadable, AI render, CN panel on SG, before-after, false badge |
| Generator hook | Merge into benchmark-v3 as `modality: image` tier `regression` candidates |
| `scripts/run-image-benchmark-stub.mjs` | Offline CI for vision stub |
| Linkage L1 | Each vision risk_type maps to playbook pattern in `skill-modules.json` |

**Exit:** Stub benchmark ≥ 90% decision accuracy on image tier.

---

## Suggested timeline

| Week | Focus |
|------|-------|
| W1 | 6A-1, 6A-2, 6A-3 stub |
| W2 | 6A-4, 6A-5 |
| W3 | 6A-6 API/UI |
| W4 | 6A-7 benchmark + pilot dry run |

---

## Dependencies

- Open Risk gateway pattern (`open-risk-llm.gateway.ts`) — reuse for vision  
- `ReviewContext.normalizedContent.imageUrls` — already present  
- Modality rules (`modality-rules.ts`) — extend for slice-level SKU extract  
- Legal: 5–10 real redacted PDP samples for benchmark seed  

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Slice boundaries cut through badges | Overlap windows + merge duplicate findings |
| Vision hallucination on Thai | Unreadable policy + confidence cap + MANUAL_REVIEW |
| Cost per PDP (many slices) | Cap `VISION_MAX_SLICES_PER_IMAGE`; merge low-risk bands |
| Runtime freeze conflict | ADR-005 explicitly extends **only** Decision inputs + new branches |

---

## Out of scope (6A)

- OCR microservice (continue manual `ocr_text` or defer to 6B)  
- Video / carousel  
- Auto-crop storage CDN  
- KOS authoring UI for vision prompts  

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-02 | Initial sprint plan from ADR-005 |
