# Sprint 5G — Knowledge Evaluation & Feedback Loop

**Status:** Closed / accepted — 2026-07-01  
**Theme:** Close the **knowledge improvement loop** — from preview consumption to measurable quality gains, without changing runtime review  
**Master roadmap:** [KNOWLEDGE-ROADMAP-v1.0.md](../knowledge/KNOWLEDGE-ROADMAP-v1.0.md) · [KNOWLEDGE-VISIBILITY.md](../knowledge/KNOWLEDGE-VISIBILITY.md)  
**Precedent:** [SPRINT-5F-PLAN.md](./SPRINT-5F-PLAN.md) (Knowledge Visibility — **accepted**) · [KNOWLEDGE-PACK.md](../knowledge/KNOWLEDGE-PACK.md)

---

## Constraints (non-negotiable)

| Constraint | Implication |
|------------|-------------|
| Runtime pipeline frozen | No changes to `Rule → Playbook → LLM → Decision` execution paths |
| No LLM prompt changes | Feedback loop does not call OpenRisk or stub LLM gateways |
| No automatic compliance decisions | Feedback captures **usefulness signals**, not PASS/WARN/REJECT |
| Preview boundary preserved | Preview remains deterministic linkage lookup only |
| No user content storage (pilot) | Feedback is metadata-only — no claim text persistence in 5G pilot |
| Knowledge Pack as release boundary | Gap reports and feedback stamps reference `knowledge_pack_id` + fingerprint |
| Baseline test failures frozen | Do not fix pre-5F failures in [BASELINE-ISSUES.md](../testing/BASELINE-ISSUES.md) within 5G unless explicitly scoped |

---

## 1. Strategic context

### 1.1 What Sprint 5F completed

Sprint 5F delivered the first **user-facing Knowledge Experience**:

```
Knowledge assets
    ↓
Knowledge Pack
    ↓
Visibility Snapshot
    ↓
User-facing Knowledge Experience (Dashboard · Explorer · Preview)
```

Stakeholders can now **see** governed knowledge. The Knowledge Operating Model is **consumable**.

### 1.2 What is missing (improvement loop)

| Stage | 5F state | 5G gap |
|-------|----------|--------|
| Preview | User sees relevant knowledge | No signal whether it was useful |
| Coverage | KQS + benchmark % on dashboard | No systematic **unmatched claim** backlog |
| Cases | Case corpus linked in graph | No path from preview miss → new case |
| Evaluation | Pack fingerprints on eval reports | No **feedback → pack quality** traceability |
| Governance | Pack release gates | No **ownership** model for gap resolution |

**Core question for 5G:** *"How does human feedback and evaluation evidence flow back into knowledge quality improvement?"*

### 1.3 Sprint 5G objective

Validate and operationalize the **complete knowledge loop**:

```
Knowledge (released pack)
    ↓
Preview (deterministic lookup)
    ↓
Human feedback (metadata)
    ↓
Gap analysis (coverage report)
    ↓
Case / corpus improvement backlog
    ↓
Knowledge quality improvement (next pack)
```

**Not in scope:** Expanding UI features, new graph layouts, or runtime pack loading.

---

## 2. Deliverable 1 — Preview feedback capture

### 2.1 Purpose

Collect lightweight **usefulness signals** on Knowledge Preview reports without storing user claim text.

### 2.2 User flow

After a preview report is generated:

```
Was this knowledge useful?
  [Yes]   [Needs update]
```

Optional (phase 2 within 5G if time):

- Category tag: `missing_skill` · `wrong_linkage` · `outdated_regulation` · `other`
- Free-text **deferred** — metadata only in pilot

### 2.3 Data model (pilot — approved schema)

```json
{
  "feedback_id": "fb-uuid",
  "recorded_at": "2026-07-01T…",
  "lifecycle_status": "captured",
  "feedback_type": "yes",
  "preview_id": "preview-uuid",
  "knowledge_pack_id": "kp-2026.07.3",
  "knowledge_pack_fingerprint": "…",
  "corpus_fingerprints": { "skill": "…", "regulation": "…" },
  "evaluation_reference": "benchmark-v3-baseline-2026-06-30",
  "primary_skill": "skill:performance-claim-review",
  "matched_skills": ["skill:…"],
  "matched_corpus_entries": ["regulation:…", "evidence:…"],
  "country": "SG",
  "claim_text_hash": "sha256-prefix",
  "reviewer_role": "legal-pilot"
}
```

| Field | Stored | Notes |
|-------|:------:|-------|
| `claim_text` | **No** | Only `claim_text_hash` for dedup / aggregate |
| `preview_id` | Yes | Links to preview session |
| `knowledge_pack_id` | Yes | Release traceability |
| `matched_corpus_entries` | Yes | Knowledge references only |
| `reviewer_role` | Optional | From `X-Knowledge-Reviewer-Role` header when available |
| User identity | No (pilot) | Internal network; auth deferred |

### 2.4 Storage (pilot)

| Option | Recommendation |
|--------|----------------|
| JSONL file under `reports/feedback/` | **Pilot default** — no DB migration |
| KOS audit table | Deferred — not 5G pilot |
| API | `POST /api/knowledge/preview/feedback` (read-only auth pattern from 5F) |

### 2.5 UI touchpoint

- knowledge-ui Preview tab — feedback buttons below report
- Non-blocking; does not alter preview result
- Draft pack warning remains visible

---

## 3. Deliverable 2 — Knowledge coverage gap report

### 3.1 Purpose

Produce an actionable **knowledge improvement backlog** from systematic gap detection.

### 3.2 Gap categories

| Gap type | Detection source | Backlog item example |
|----------|------------------|----------------------|
| Unmatched claims | Preview with zero `matched_skills` | Add signal_terms to skill X |
| Missing skills | Claim clusters with no skill coverage | Author `skill:new-claim-type-review` |
| Missing evidence mappings | Skill with empty `linkage.evidence` | Link `evidence:…` to skill |
| Missing cases | Skill with no validating cases | Add `case:…` with `benchmark_ref` |
| Orphan regulations | Dependency graph orphans | Review regulation linkage |
| Low KQS corpus | Platform snapshot KQS < threshold | Governance refresh |

### 3.3 Inputs

| Source | Usage |
|--------|-------|
| Preview feedback (`needs_update`) | Prioritize gaps users flagged |
| Preview run log (stdout / JSONL) | Aggregate `matched_skills` empty rate |
| Knowledge Pack `dependency_graph` | Orphan counts |
| Benchmark v3 cases | Cases without case-corpus `benchmark_ref` |
| Visibility snapshot | KQS by corpus |

### 3.4 Output artifact

```bash
pnpm knowledge:coverage-gap-report
```

Writes `reports/knowledge-gap-{timestamp}.md` + `.json`:

```markdown
# Knowledge Coverage Gap Report

**Knowledge Pack:** kp-2026.07.3
**Generated:** …

## Priority backlog

| Priority | Gap | Corpus | Suggested action | Owner |
|----------|-----|--------|------------------|-------|
| P1 | Unmatched: "sterilizes air" | skill | Add detection pattern | knowledge-eng |
| P2 | skill:certification-claim-review — no cases | case | Add validation case | legal-pilot |
```

### 3.5 Prioritization rules (deterministic — approved)

| Priority | Category | Example |
|----------|----------|---------|
| **P1** | Missing regulation linkage | Skill without `linkage.regulations`; orphan regulation node |
| **P2** | Missing required evidence mapping | Skill with empty `linkage.evidence` |
| **P3** | Repeated unmatched claim pattern | Feedback `needs_update` with empty `matched_skills`; case without `benchmark_ref` |
| **P4** | Low confidence knowledge mapping | Sparse `signal_terms`; feedback `needs_update` with matched skills |
| **P5** | Freshness / governance issue | KQS below threshold; stale entries; governance warnings |

No ML ranking in 5G.

---

## 4. Deliverable 3 — Evaluation linkage & regression validation

### 4.1 Purpose

Confirm the knowledge layer does not regress runtime benchmark behavior as packs evolve.

### 4.2 Regression gate (5G acceptance)

```bash
pnpm eval:benchmark-v3 -- --tier=regression
pnpm --filter @aairp/application test -- benchmark-v3-baseline benchmark-regression
```

| Check | Expected |
|-------|----------|
| Regression tier | 9/9 pass |
| Weighted quality | ≥ 97.8% (baseline) |
| Decision accuracy | 100% |
| `regression_status` | `stable` |
| Knowledge Pack stamp | `knowledge_pack_version` + `knowledge_pack_fingerprint` on eval JSON |

**Post–5F verification (2026-07-01):** All checks passed. Report: `reports/eval-v3-2026-07-01T05-51-15-747Z.json`.

### 4.3 Pack ↔ eval traceability

Every gap report and feedback record must include:

- `knowledge_pack_id`
- `knowledge_pack_fingerprint`
- `evaluated_at` (for eval runs)

Enables future comparison: *"Did pack kp-2026.08.1 improve gap rate vs kp-2026.07.3?"*

### 4.4 CI recommendation

| Job | Blocks merge |
|-----|:------------:|
| `eval:benchmark-v3 --tier=regression` | Yes (5G+) |
| `knowledge:coverage-gap-report` | Warn |
| Feedback API smoke test | Warn (5G pilot) |

---

## 5. Governance ownership

### 5.1 Roles

| Role | Responsibility in 5G |
|------|----------------------|
| **Knowledge engineer** | Runs gap report; authors corpus fixes; assembles draft pack |
| **Legal pilot** | Validates P1 feedback; approves new cases |
| **Eval owner** | Runs regression; confirms stable baseline |
| **Release approver** | Manual `pnpm knowledge:release-knowledge-pack` after gap closure |

### 5.2 Feedback → improvement workflow

```
Preview feedback (needs_update)
    ↓
Gap report entry (P1)
    ↓
Corpus PR (skill / evidence / case / regulation)
    ↓
Validator pass + pack assemble
    ↓
Regression eval stable
    ↓
Manual pack release
    ↓
Visibility snapshot rebuild
```

### 5.3 What feedback does **not** do

- Does not auto-edit corpus JSON
- Does not auto-release packs
- Does not trigger review pipeline
- Does not store full claim text (pilot)

---

## 6. No-runtime-change boundary

### 6.1 Allowed in 5G

| Layer | Changes |
|-------|---------|
| `knowledge-preview.service.ts` | Emit gap signals; optional feedback hook |
| `knowledge-*-report.ts` | New gap report builder |
| `apps/knowledge-ui/` | Feedback buttons on preview tab |
| `apps/api/` | `POST /api/knowledge/preview/feedback` |
| `docs/product/` | PRD for feedback + gap report |
| `reports/` | Feedback JSONL, gap reports |

### 6.2 Forbidden in 5G

| Layer | Reason |
|-------|--------|
| `review-pipeline.service.ts` | Runtime frozen |
| `rule-engine.service.ts` | Runtime frozen |
| `open-risk-discovery.service.ts` | LLM path frozen |
| `decision-engine.service.ts` | Runtime frozen |
| Runtime pack loading | Deferred to Sprint 6+ |
| Fixing [BASELINE-ISSUES.md](../testing/BASELINE-ISSUES.md) | Out of scope unless sprint owner accepts |

### 6.3 Isolation test (extend 5F pattern)

```typescript
// knowledge-gap-report.spec.ts
it('does not import review pipeline services', () => {
  const source = readFileSync('knowledge-gap-report.ts', 'utf8');
  expect(source).not.toMatch(/review-pipeline|rule-engine|open-risk|decision-engine/);
});
```

---

## 7. Implementation plan

### 7.1 Epic breakdown

| Epic | Scope | Outcome |
|------|-------|---------|
| **G1** | Preview feedback API + JSONL writer | `POST /api/knowledge/preview/feedback` |
| **G2** | Feedback UI (knowledge-ui preview tab) | Yes / Needs update buttons |
| **G3** | Coverage gap report service + CLI | `pnpm knowledge:coverage-gap-report` |
| **G4** | Gap prioritization + backlog markdown | `reports/knowledge-gap-*.md` |
| **G5** | Eval linkage stamps on feedback/gap artifacts | Pack ID + fingerprint everywhere |
| **G6** | Tests + CI guards | Gap isolation; regression gate documented |
| **G7** | Product docs | `PRD-PREVIEW-FEEDBACK.md`, `PRD-COVERAGE-GAP-REPORT.md` |

### 7.2 Recommended order

```
G5 (stamp contract)
    ↓
G1 → G2 (feedback capture)
    ↓
G3 → G4 (gap report)
    ↓
G6 → G7 (tests + docs)
```

### 7.3 Explicitly out of scope (5G)

| Item | Deferred to |
|------|-------------|
| Preview API authentication / RBAC | 5G hardening or 6 |
| Full-text claim storage | Never in visibility layer |
| Auto corpus editing from feedback | 6+ |
| KOS feedback sync | 6 |
| UI feature expansion (new tabs, graph analytics) | 6 |
| Runtime Knowledge Pack loading | 6+ |
| Fixing 3 baseline test failures | Sprint 6 (review pipeline) |

---

## 8. File map (planned)

```
packages/application/src/knowledge/
  knowledge-preview-feedback.ts
  knowledge-gap-report.ts
  run-coverage-gap-report.ts
  knowledge-gap-report.spec.ts
  knowledge-preview-feedback.spec.ts

apps/api/src/controllers/
  knowledge-preview-feedback.controller.ts

apps/knowledge-ui/public/
  app.js                    # feedback UI hooks

docs/product/
  PRD-PREVIEW-FEEDBACK.md
  PRD-COVERAGE-GAP-REPORT.md

docs/testing/
  BASELINE-ISSUES.md        # existing — do not fix in 5G
```

---

## 9. Acceptance criteria (Sprint 5G success)

- [x] Feedback captured (Yes / Needs update)
- [x] Feedback linked to Knowledge Pack (`knowledge_pack_id` + fingerprint + corpus fingerprints)
- [x] Gap report generated (`pnpm knowledge:coverage-gap-report`)
- [x] Priority queue generated (P1–P5 summary)
- [x] Knowledge Improvement Queue visible on existing Dashboard (not a new product surface)
- [x] No runtime changes
- [x] No LLM dependency
- [x] Existing regression remains stable (`pnpm eval:benchmark-v3 -- --tier=regression`)
- [x] No claim text / documents stored in feedback
- [x] Product PRDs under `docs/product/`
- [x] Baseline test failure count not increased

---

## 10. Feedback lifecycle

Feedback is a **knowledge improvement signal** — not knowledge itself.

```
Captured
    ↓
Reviewed          (legal pilot triage)
    ↓
Converted         (backlog item / corpus task)
    ↓
Implemented       (corpus PR merged)
    ↓
Released          (new Knowledge Pack)
```

| Status | Meaning | 5G pilot |
|--------|---------|----------|
| `captured` | Recorded from preview UI/API | **Default on create** |
| `reviewed` | Legal/knowledge eng acknowledged | Manual (future API) |
| `converted` | Linked to gap backlog task | Manual |
| `implemented` | Corpus change merged | Manual |
| `released` | Included in released pack | Manual |

5G stores `lifecycle_status: captured` only. Status transitions are manual/out-of-band until 6+.

---

## 11. Feedback privacy boundary

### Allowed to store

- Metadata (timestamps, feedback type, lifecycle status)
- Knowledge references (`matched_skills`, `matched_corpus_entries`, pack fingerprints)
- Evaluation references (`evaluation_reference`, regression baseline report path)
- `claim_text_hash` (one-way dedup — not reversible to claim text in pilot)

### Not stored

- Customer advertising materials / claim text
- Confidential business content
- Uploaded documents
- User-generated compliance reasoning / free-text notes (deferred)

Preview API may return claim text to the client session; feedback persistence must **not** copy it.

---

## 12. Knowledge Improvement Dashboard (5G)

**Not a new product surface.** Extension of the existing Knowledge Dashboard tab.

```
Knowledge Improvement Queue
├── P1 gaps: N
├── P2 gaps: N
├── P3 gaps: N
├── P4 gaps: N
├── P5 gaps: N
├── Evidence gaps: N
└── Unmapped claims: N
```

**Data source:** `improvement_queue` section in `knowledge-visibility.snapshot.json`, built from `summarizeImprovementQueue()` at snapshot generation time.

**Purpose:** Turn knowledge maintenance into an operational process.

---

## 13. Regression baseline (frozen)

| Item | Value |
|------|-------|
| Command | `pnpm eval:benchmark-v3 -- --tier=regression` |
| Baseline report | `reports/eval-v3-2026-07-01T05-51-15-747Z.json` |
| Knowledge Pack | `kp-2026.07.3` + corpus fingerprints |

Every future knowledge release must answer:

1. **What changed in knowledge?** (pack fingerprint diff)
2. **Did evaluation behavior change?** (regression tier stable)

---

## 14. Commands

```bash
pnpm knowledge:coverage-gap-report
pnpm knowledge:build-visibility-snapshot
pnpm eval:benchmark-v3 -- --tier=regression
# Feedback via API:
curl -X POST /api/knowledge/preview/feedback \
  -H 'Content-Type: application/json' \
  -H 'X-Knowledge-Reviewer-Role: legal-pilot' \
  -d '{"preview_id":"…","feedback_type":"needs_update","claim_text_hash":"…"}'
```

---

## 15. Relationship to documentation layers

| Layer | Location | 5G adds |
|-------|----------|---------|
| Engineering | `docs/knowledge/` | [KNOWLEDGE-FEEDBACK-LOOP.md](../knowledge/KNOWLEDGE-FEEDBACK-LOOP.md) |
| Product | `docs/product/` | Preview feedback PRD, gap report PRD |
| Testing | `docs/testing/` | Baseline issues (existing) |

Keep **engineering** vs **product** documentation separate going forward.
