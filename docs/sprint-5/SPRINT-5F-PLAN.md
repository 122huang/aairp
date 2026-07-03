# Sprint 5F — Knowledge Visibility & Review Experience

**Status:** Closed / accepted — 2026-06-29  
**Theme:** First **user-facing product layer** — expose the governed knowledge graph and release state without changing runtime  
**Master roadmap:** [KNOWLEDGE-ROADMAP-v1.0.md](../knowledge/KNOWLEDGE-ROADMAP-v1.0.md) · [KNOWLEDGE-PACK.md](../knowledge/KNOWLEDGE-PACK.md)  
**Precedent:** [SPRINT-5E-PLAN.md](./SPRINT-5E-PLAN.md) (Knowledge Pack complete) · [SPRINT-2A-KOS-ROADMAP.md](../sprint-2a/SPRINT-2A-KOS-ROADMAP.md)

---

## Constraints (non-negotiable)

| Constraint | Implication |
|------------|-------------|
| Runtime pipeline frozen | No changes to `Rule → Playbook → LLM → Decision` |
| No LLM prompt changes | Preview does not call OpenRisk or stub LLM gateways |
| No automatic decisions | Preview is **informational** — no PASS/WARN/REJECT output |
| No benchmark replacement | Eval pipeline unchanged; preview is separate artifact |
| No document storage | Evidence display is requirement metadata only |
| No sixth corpus | Visualize existing five corpora only |
| Knowledge Pack as release boundary | UI reads **released** pack when available; draft labeled clearly |
| Read-only consumption | No KOS write, no pack release, no corpus edit from UI |

---

## 1. Strategic context

### 1.1 What Sprint 5E completed

Sprint 5E closed the **Knowledge Lifecycle** layer:

```
Knowledge Creation (5 corpora)
    ↓
Corpus Governance (validators, KQS)
    ↓
Knowledge Assembly (manifests)
    ↓
Release Management (Knowledge Pack v2)
    ↓
Evaluation Traceability (pack stamps on eval reports)
```

AAIRP has moved from *knowledge asset collection* to a **governed Knowledge Operating Model**. The missing piece is **visibility** — stakeholders cannot yet *see* that the system exists or why it is more than an LLM wrapper.

### 1.2 What exists today (visibility gap)

| Artifact | Audience | Limitation |
|----------|----------|------------|
| CLI dashboards (`reports/*.md`) | Engineering | Not user-facing |
| `admin-ui` + `knowledge-manifest.json` | Legal pilot | Demo/runtime linkage only — not five-corpus graph |
| KOS search API | Admin | Operational objects (rules, cases) — not corpus knowledge graph |
| Eval reports | Engineering | Outcome metrics — not product narrative |

**Gap:** No single view answers *"What knowledge governs this claim type, under which release, and how is it linked?"*

### 1.3 Sprint 5F objective

Create the **first visible product layer** — three read-only deliverables:

```
Released Knowledge Pack
        ↓
Visibility Snapshot (build artifact)
        ↓
┌───────────────────┬────────────────────┬─────────────────────────┐
│ Knowledge         │ Knowledge Graph    │ Review Preview          │
│ Dashboard         │ Explorer           │ (read-only report)      │
└───────────────────┴────────────────────┴─────────────────────────┘
```

**Core question answered:** *"Show me that AAIRP has governed, linked, released knowledge — and what it would surface for this claim."*

---

## 2. Deliverable 1 — Knowledge Dashboard

### 2.1 Purpose

First visual artifact for **management and legal** stakeholders. Proves the knowledge system exists, is measured, and is released under version control.

**Not:** a corpus editor, KOS admin console, or runtime ops dashboard.

### 2.2 Information architecture

```
Knowledge Dashboard
├── Release header
│   ├── Knowledge Pack ID (e.g. kp-2026.07.1)
│   ├── Release status (released / draft / none)
│   ├── Fingerprint (truncated + copy)
│   ├── Released at / released by
│   └── Supersedes chain (if any)
├── Platform summary
│   ├── Platform version
│   ├── Total knowledge entries (137)
│   └── Last snapshot generated at
├── Corpus cards (×5)
│   ├── Regulation — 75 entries — KQS 92.2%
│   ├── Skill — 5 skills — KQS 100%
│   ├── Rewrite — 9 assets — KQS ~96%
│   ├── Evidence — 20 requirements — KQS ~98%
│   └── Case — 28 validation cases — KQS ~90%
│   └── Per card: entry count, KQS, freshness band, validation errors/warnings
├── Quality vs coverage (side-by-side — do not merge)
│   ├── KQS row — asset quality per corpus
│   └── Coverage row — benchmark coverage (Case), market/country (Regulation)
├── Dependency summary (from pack frozen graph)
│   ├── Node counts
│   └── Orphan warnings (informational)
└── Evaluation linkage
    ├── Benchmark fingerprint
    ├── Case corpus benchmark coverage %
    └── Regression baseline ref
```

### 2.3 Primary user stories

| Persona | Story |
|---------|-------|
| Legal lead | See which Knowledge Pack is active and when it was released |
| Knowledge eng | See corpus KQS and validation warnings at a glance |
| Management | See five-corpus architecture is operational with entry counts |
| Eval owner | See benchmark coverage separate from KQS |

### 2.4 UI approach

**Decision (pending sign-off):** New `apps/knowledge-ui/` static app at `/knowledge/` — not a tab in `admin-ui`.

Pilot: Vanilla JS + CSS matching existing app patterns (Inter font, card layout from `admin-ui/styles.css`). Dashboard reads static snapshot; Preview tab calls read-only API.

### 2.5 Dashboard data contract

New build artifact: `apps/knowledge-ui/public/knowledge-visibility.snapshot.json`

Generated by: `pnpm knowledge:build-visibility-snapshot`

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-07-01T…",
  "knowledge_pack": {
    "knowledge_pack_id": "kp-2026.07.1",
    "release_status": "released",
    "knowledge_pack_fingerprint": "…",
    "released_at": "…",
    "released_by": "…"
  },
  "platform": {
    "platform_version": "1.0.0",
    "corpora": [
      {
        "corpus_type": "regulation",
        "entry_count": 75,
        "knowledge_quality_score": 90.8,
        "freshness": { "green": 75, "yellow": 0, "red": 0 },
        "validation_errors": 0,
        "governance_warnings": 28
      }
    ]
  },
  "coverage_metrics": {
    "case_benchmark_coverage_pct": 30.4,
    "regulation_countries": ["SG", "MY", "TH", "ID", "JP", "KR", "AU"]
  },
  "dependency_graph_summary": { "nodes": {}, "orphan_counts": {} }
}
```

**Source priority:**

1. **Released** `benchmark/knowledge-pack.manifest.json` (v2) when `release_status: released`
2. Else **draft** from `benchmark/knowledge-pack/drafts/` — UI shows **"Draft — not released"** banner
3. Corpus metrics from pack snapshot (frozen) when released; live manifest when draft-only

---

## 3. Deliverable 2 — Knowledge Graph Explorer

### 3.1 Purpose

Demonstrate **linkage value** — why AAIRP is more than an LLM wrapper. Shows how Regulation → Skill → Rewrite → Evidence → Case connect for a claim type.

### 3.2 Visualization model

**Primary navigation axis:** Skill (review capability hub)

**Secondary entry points:** Claim cluster (health, performance, comparative, certification, disclosure)

```
Skill: Health Claim Review
    │
    ├── Regulations (linkage.regulations)
    │     └── regulation:sg-hsa-supplement-health-claims
    │           summary, country, risk_level
    │
    ├── Rules (linkage.rules) — demo rule IDs with labels
    │
    ├── Evidence (via skill evidence_requirement + evidence corpus linkage)
    │     └── evidence:health-claim-substantiation
    │           requirement_level, validation_criteria summary
    │
    ├── Rewrites (linkage.rewrites + output_schema.rewrite_linkage)
    │     └── rewrite:remove-health-claim
    │           strategy, must_remove_terms (truncated)
    │
    └── Cases (case corpus entries linking to this skill)
          └── case:sg-health-reject-cure
                benchmark_ref, case_result (declarative)
```

**Evidence orthogonality:** Evidence nodes attach to Skill (and optionally Rewrite) — not inline in the vertical Rule chain. Visual layout:

```
        Evidence ────┐
                     ↓
Regulation → Rule → Skill → Rewrite
                     ↓
                   Case
```

### 3.3 Graph data model

Build artifact: `knowledge-graph.snapshot.json` (or embedded in visibility snapshot)

```json
{
  "nodes": [
    {
      "id": "skill:health-claim-review",
      "corpus_type": "skill",
      "label": "Health Claim Review",
      "summary": "…",
      "claim_types": ["health-claim"]
    }
  ],
  "edges": [
    {
      "from": "skill:health-claim-review",
      "to": "regulation:sg-hsa-supplement-health-claims",
      "relation": "governed_by"
    },
    {
      "from": "skill:health-claim-review",
      "to": "evidence:health-claim-substantiation",
      "relation": "requires_evidence"
    }
  ],
  "indexes": {
    "by_claim_type": { "health-claim": ["skill:health-claim-review"] },
    "by_corpus_type": { "skill": ["skill:health-claim-review", "…"] }
  }
}
```

**Construction rules:**

- Nodes = all active corpus entries (production/verified statuses)
- Edges derived from `KnowledgeLinkage` via existing adapters — no new linkage semantics
- Case nodes include `benchmark_ref` only — no ad text
- Regulation nodes include `summary` + `country` — no full citation blobs
- Max depth: 2 hops from selected skill (avoid graph explosion)

### 3.4 Explorer UX (recommended)

| View | Behavior |
|------|----------|
| **Browse by skill** | Left sidebar: 5 skills; select to expand graph |
| **Browse by claim type** | Filter chips: health / performance / comparative / certification / disclosure |
| **Detail panel** | Right panel: selected node metadata + review_guidance excerpt |
| **Graph canvas** | Simple tree or layered DAG (CSS/HTML — no D3 requirement for pilot) |

**Pilot scope:** 5 skills × linked assets only (~137 nodes max, ~400 edges estimated). No full-text search in 5F (defer to KOS search integration in 5G).

### 3.5 Example walkthrough (target demo)

User selects **Health Claim Review**:

| Layer | Shown assets |
|-------|--------------|
| Regulations | SG supplement health claims, HPA S7 prohibited claims |
| Evidence | Health claim substantiation requirement |
| Rewrite | Remove health claim, qualify efficacy |
| Cases | sg-health-reject-cure, PC-008, supplement-before-after-imagery |

---

## 4. Deliverable 3 — Knowledge-powered Review Preview

### 4.1 Purpose

**Read-only report generator** that demonstrates product value using existing knowledge assets. Answers: *"If I pasted this claim, what knowledge would AAIRP surface?"*

**Explicitly not:** a review decision, runtime submission, or LLM analysis.

### 4.2 Preview vs runtime (boundary)

| Aspect | Runtime review | 5F Preview |
|--------|----------------|------------|
| Pipeline | Rule → Playbook → LLM → Decision | Knowledge lookup only |
| Output | PASS/WARN/REJECT | Informational report |
| LLM | Yes (OpenRisk) | **No** |
| Rule engine | Yes | **No** |
| Data source | Demo rules + runtime | **Released pack + corpus entries** |
| Label | Live review | **"Knowledge Preview — not a compliance decision"** |

### 4.3 Preview design

**Input:**

```json
{
  "claim_text": "99.9999% bacteria removal",
  "country": "SG",
  "category": "electronics",
  "modality": "text"
}
```

**Output (KnowledgePreviewReport):**

```json
{
  "preview_id": "preview-uuid",
  "generated_at": "2026-07-01T…",
  "disclaimer": "Knowledge Preview — not a compliance decision. No runtime pipeline executed.",
  "knowledge_pack_id": "kp-2026.07.1",
  "input_summary": {
    "claim_text": "99.9999% bacteria removal",
    "detected_signals": ["bacteria removal", "percentage claim"]
  },
  "matched_skills": [
    {
      "knowledge_id": "skill:health-claim-review",
      "label": "Health Claim Review",
      "match_reason": "signal_terms: bacteria, removal",
      "confidence": "medium"
    },
    {
      "knowledge_id": "skill:performance-claim-review",
      "label": "Performance Claim Review",
      "match_reason": "signal_terms: 99.9999%",
      "confidence": "medium"
    }
  ],
  "primary_skill": "skill:performance-claim-review",
  "claim_types": ["performance-claim", "health-claim"],
  "linked_knowledge": {
    "regulations": [{ "knowledge_id": "…", "summary": "…" }],
    "evidence": [{ "knowledge_id": "…", "requirement_level": "required" }],
    "rewrites": [{ "knowledge_id": "…", "strategy": "qualify" }],
    "cases": [{ "knowledge_id": "…", "benchmark_ref": "AF-004" }]
  },
  "guidance_excerpt": {
    "review_guidance": "TRIGGER: Quantitative performance claim…",
    "rewrite_hint": "Qualify efficacy statement with substantiation reference"
  }
}
```

### 4.4 Matching engine (deterministic — no LLM)

New service: `knowledge-preview.service.ts`

| Step | Logic |
|------|-------|
| 1. Signal extraction | Tokenize claim text; match against skill `detection_patterns.signal_terms` and rewrite `measurable_criteria.must_remove_terms` |
| 2. Skill ranking | Score = count of matched signals per skill; tie-break by claim_type applicability (country/category) |
| 3. Graph expansion | From top skill(s), walk linkage to regulations, evidence, rewrites, cases (same graph as Explorer) |
| 4. Evidence requirement | Read `evidence_requirement` from skill + linked evidence entries |
| 5. Pack stamp | Attach `knowledge_pack_id` from released manifest |

**No calls to:** `ReviewPipelineService`, `RuleEngineService`, `OpenRiskDiscoveryService`, `DecisionEngineService`.

### 4.5 Preview delivery modes

| Mode | Route | Use case |
|------|-------|----------|
| **CLI** | `pnpm knowledge:preview -- --text "…"` | Engineering / demo scripts |
| **API (read-only)** | `POST /api/knowledge/preview` | knowledge-ui form |
| **Markdown export** | `reports/knowledge-preview-{id}.md` | Share with legal |

API is a **new controller** — not wired into `/demo/review` or review-ui pipeline.

### 4.6 Example output (user-facing markdown)

```markdown
# Knowledge Preview Report

> **Not a compliance decision.** This report shows which governed knowledge
> assets apply. No rules were executed and no LLM was called.

**Knowledge Pack:** kp-2026.07.1
**Claim:** "99.9999% bacteria removal"

## Claim Types
Performance claim · Health implication (possible)

## Relevant Skill
**Performance Claim Review** — quantitative efficacy language detected

## Required Evidence
- Performance lab report (required)
- Substantiation on file before publication

## Rewrite Guidance
- Qualify efficacy statement
- Cite evidence / certification where applicable

## Related Validation Cases
- AF-004 (benchmark) — performance claim scenario
- case:af-004 — expected REVIEW / ESCALATE

## Linked Regulations
- SG HSA efficacy and performance claims (summary excerpt)
```

---

## 5. Data sources

### 5.1 Source hierarchy

| Data need | Primary source | Fallback |
|-----------|----------------|----------|
| Release identity | `benchmark/knowledge-pack.manifest.json` (v2 released) | Draft + banner |
| Corpus counts / KQS | Pack `corpora.*` snapshot (released) | Live platform snapshot |
| Entry metadata | Corpus JSON via loaders (`load*CorpusEntries`) | — |
| Linkage graph | `getLinkage()` adapters per plugin | — |
| Benchmark refs | Case `benchmark_ref` | — |
| Rule labels | `demo/rules.demo.json` (display only) | rule_id raw |
| Regression baseline | Pack `evaluation_linkage.regression_baseline_ref` | External file |

### 5.2 Build pipeline (recommended)

```bash
# Existing
pnpm knowledge:validate-*-corpus    # 5 corpora
pnpm knowledge:validate-knowledge-pack

# New in 5F
pnpm knowledge:build-visibility-snapshot   # dashboard + graph JSON
pnpm knowledge:preview -- --text "…"       # CLI preview report
```

Build order:

```
Validate corpora (0 errors)
    → Validate pack (0 errors)
    → build-visibility-snapshot
    → copy snapshot to apps/knowledge-ui/public/
```

### 5.3 What NOT to load in UI

| Excluded | Reason |
|----------|--------|
| `case-library/` payloads | Ops archive — not knowledge release |
| Benchmark fixture `text` fields | Eval fixtures — Case Corpus uses metadata |
| Evidence document binaries | No document storage |
| Runtime playbook markdown body | Runtime artifact — Rewrite Corpus is knowledge source |
| Unreleased draft pack (without banner) | Misleading release state |

---

## 6. Permission and governance considerations

### 6.1 Audience tiers (pilot)

| Tier | Access | Content |
|------|--------|---------|
| **Public internal** | `/knowledge/` static UI | Dashboard + Explorer (released pack only in prod builds) |
| **Admin** | Preview API + CLI | Full preview including draft pack indicator |
| **Legal** | Same as internal | Emphasis on regulation summaries and disclaimers |
| **External** | **None in 5F** | No public internet deployment |

### 6.2 Governance rules for display

| Rule | Implementation |
|------|----------------|
| Draft pack visibility | Yellow banner: *"Draft pack — not released for evaluation"* |
| Deprecated entries | Show `review_status: deprecated` badge; exclude from preview matching by default |
| Case verification | Show `verification_status` on case nodes — do not imply legal sign-off from preview |
| KQS vs coverage | Never combine into single score in UI |
| Preview disclaimer | Required on every preview report — cannot be dismissed |
| PII | Do not display case-library ad text; preview input is user-provided only |

### 6.3 Audit (informational)

Log preview API calls to stdout / optional audit file — **not** KOS audit table in 5F. Fields: `timestamp`, `knowledge_pack_id`, `input_hash`, `matched_skills[]`.

---

## 7. No-runtime-change validation

### 7.1 Frozen paths (must have zero diff)

```
packages/application/src/review/rule-engine.service.ts
packages/application/src/review/playbook-engine.service.ts
packages/application/src/review/open-risk-discovery.service.ts
packages/application/src/review/decision-engine.service.ts
packages/application/src/review/review-pipeline.service.ts
demo/rules.demo.json
demo/playbook.demo.md
demo/open-risk.prompt.txt
```

### 7.2 Allowed new surfaces

```
packages/application/src/knowledge/knowledge-visibility-snapshot.ts
packages/application/src/knowledge/knowledge-graph-builder.ts
packages/application/src/knowledge/knowledge-preview.service.ts
packages/application/src/knowledge/run-build-visibility-snapshot.ts
packages/application/src/knowledge/run-knowledge-preview.ts
apps/api/src/controllers/knowledge-preview.controller.ts   (read-only)
apps/knowledge-ui/public/*
```

### 7.3 CI guard (recommended)

| Check | Blocks merge |
|-------|:------------:|
| `pnpm test` — existing review specs pass | Yes |
| `pnpm eval:benchmark-v3 --regression` unchanged | Yes |
| New `knowledge-preview.spec.ts` — no imports from review pipeline | Yes |
| Snapshot build succeeds | Warn in 5F |

### 7.4 Acceptance test: preview isolation

```typescript
// knowledge-preview.spec.ts
it('does not import review pipeline services', async () => {
  const source = readFileSync('knowledge-preview.service.ts', 'utf8');
  expect(source).not.toMatch(/review-pipeline|rule-engine|open-risk|decision-engine/);
});
```

---

## 8. Implementation plan

### 8.1 Epic breakdown

| Epic | Scope | Outcome |
|------|-------|---------|
| **E1** | Visibility snapshot builder | `knowledge-visibility.snapshot.json` + graph index |
| **E2** | Knowledge Dashboard UI | `apps/knowledge-ui/` — release header + corpus cards |
| **E3** | Graph Explorer UI | Skill-centric browse + detail panel |
| **E4** | Preview service | Deterministic matcher + report formatter |
| **E5** | Preview API + CLI | `POST /api/knowledge/preview`, `pnpm knowledge:preview` |
| **E6** | Preview UI form | knowledge-ui preview tab |
| **E7** | Tests + CI guards | Snapshot, graph, preview isolation, review specs green |
| **E8** | Docs | `KNOWLEDGE-VISIBILITY.md`, authoring standard §2.7 |

### 8.2 Explicitly out of scope (5F)

| Item | Deferred to |
|------|-------------|
| Runtime pack loading | 6+ |
| LLM-enhanced preview | 6+ |
| KOS graph sync | 5G / 6 |
| Full-text corpus search UI | 5G |
| Document upload / evidence viewer | Never in visibility layer |
| Mobile-native app | — |
| i18n (beyond EN pilot) | 5G |
| Authentication / RBAC hardening | 5G (pilot: internal network) |

### 8.3 Files to create (planned)

```
docs/knowledge/KNOWLEDGE-VISIBILITY.md
apps/knowledge-ui/public/index.html
apps/knowledge-ui/public/app.js
apps/knowledge-ui/public/styles.css
apps/knowledge-ui/public/knowledge-visibility.snapshot.json   # generated

packages/application/src/knowledge/
  knowledge-visibility-snapshot.ts
  knowledge-graph-builder.ts
  knowledge-preview.service.ts
  run-build-visibility-snapshot.ts
  run-knowledge-preview.ts
  knowledge-preview.spec.ts
  knowledge-visibility.spec.ts

apps/api/src/controllers/knowledge-preview.controller.ts
apps/api/src/dto/knowledge-preview.dto.ts
```

### 8.4 Commands (after 5F)

```bash
pnpm knowledge:build-visibility-snapshot
pnpm knowledge:preview -- --text "removes 99.9999% bacteria" --country SG
pnpm knowledge:validate-knowledge-pack          # prerequisite
# Serve: /knowledge/index.html (via existing static file server)
```

---

## 9. Acceptance criteria

- [x] Knowledge Dashboard shows released pack ID, status, and five corpus cards with KQS
- [x] KQS and benchmark coverage displayed separately (not merged)
- [x] Graph Explorer navigates Skill → Regulation / Evidence / Rewrite / Case linkage
- [x] No ad text or case-library payloads in graph or dashboard
- [x] Preview report generated from claim text without calling review pipeline or LLM
- [x] Every preview includes non-dismissable disclaimer
- [x] Preview stamps `knowledge_pack_id` from released manifest
- [x] `pnpm eval:benchmark-v3 --tier=regression` regression unchanged (verified 2026-07-01: 9/9, 97.8% WQS, stable)
- [ ] All existing review pipeline tests pass (3 pre-5F baseline failures — see [BASELINE-ISSUES.md](../testing/BASELINE-ISSUES.md))
- [x] Visibility snapshot buildable from released or draft pack (draft labeled)

---

## 10. Review disposition — **APPROVED** (2026-06-29)

| # | Question | Recommended decision | Rationale |
|---|----------|---------------------|-----------|
| 1 | UI host | **New `apps/knowledge-ui/`** at `/knowledge/` | Separates product narrative from admin demo pipeline; avoids conflating runtime trace with knowledge release |
| 2 | Preview API auth | **Open on internal network for pilot**; no API key in 5F | Matches admin-ui/review-ui pilot pattern; add API-key gate in 5G when external exposure is considered |
| 3 | Graph layout | **HTML/CSS layered tree for pilot** | No new frontend dependency; sufficient for 5 skills × ~137 nodes; canvas (Cytoscape) deferred to 5G if graph grows |
| 4 | Language | **EN-first content** (corpus-aligned); minimal zh-Hans chrome only (nav labels) | Corpus entries are English; legal summaries stay English; reuse admin-ui topbar pattern for consistency |
| 5 | Released-only builds | **Warn, do not fail** if no released pack | Allow draft snapshot with banner for local dev; CI informational job reports `release_status`; hard fail deferred to 5G production gate |
| 6 | Preview skill match | **Show all matched skills** (ranked) + one **primary_skill** | Transparency for ambiguous claims (e.g. health + performance); primary = highest signal score for summary header |

### Additional adjustments (recommended)

| Topic | Decision |
|-------|----------|
| Snapshot source | Released pack fingerprints when `release_status: released`; else draft + yellow banner |
| Preview disclaimer | Fixed text, always visible above results — not dismissable |
| Static vs API dashboard | Dashboard reads static snapshot only; Preview uses API/CLI |
| Admin-ui | Unchanged — no new tab in 5F |

### Open questions (resolved pending sign-off)


## Revision history

| Date | Change |
|------|--------|
| 2026-07-01 | Initial Sprint 5F plan — Knowledge Visibility & Review Experience (planning only) |
