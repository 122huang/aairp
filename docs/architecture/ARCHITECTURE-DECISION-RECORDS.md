# Architecture Decision Records — Sprint 5 Knowledge Platform

**Status:** Accepted (stable)  
**Date:** 2026-07-01  
**Scope:** Decisions from Sprint 5A–5G and S6.2 product integration  
**Note:** Strategic EKS vision remains in [ADR-004 — Executable Knowledge System](../adr/ADR-004-executable-knowledge-system.md). Multimodal visual compliance is [ADR-005](../adr/ADR-005-multimodal-visual-compliance.md). This registry captures **operational** decisions from platform construction.

---

## Index

| ID | Title | Status |
|----|-------|--------|
| [ADR-001](#adr-001-runtime-frozen-principle) | Runtime Frozen Principle | Accepted |
| [ADR-002](#adr-002-knowledge-first-architecture) | Knowledge-First Architecture | Accepted |
| [ADR-003](#adr-003-five-corpus-knowledge-model) | Five-Corpus Knowledge Model | Accepted |
| [ADR-004](#adr-004-knowledge-pack-release-model) | Knowledge Pack Release Model | Accepted |
| [ADR-005](#adr-005-immutable-release-strategy) | Immutable Release Strategy | Accepted |
| [ADR-006](#adr-006-knowledge-visibility-snapshot-pattern) | Knowledge Visibility Snapshot Pattern | Accepted |
| [ADR-007](#adr-007-deterministic-preview-boundary) | Deterministic Preview Boundary | Accepted |
| [ADR-008](#adr-008-feedback-driven-knowledge-improvement) | Feedback-Driven Knowledge Improvement | Accepted |
| [ADR-009](#adr-009-kqs-vs-coverage-separation) | KQS vs Coverage Separation | Accepted |
| [ADR-010](#adr-010-manual-knowledge-release-authority) | Manual Knowledge Release Authority | Accepted |
| [ADR-011](#adr-011-product-shell-vs-platform-s62) | Product Shell vs Platform (S6.2) | Accepted |

---

## ADR-001: Runtime Frozen Principle

**Status:** Accepted

### Context

AAIRP review outcomes depend on a stable `Rule → Playbook → LLM → Decision` pipeline. Knowledge platform work ran in parallel with legal pilot and benchmark regression.

### Decision

The review runtime pipeline is **frozen** during knowledge platform sprints. Knowledge work must not change rule matching, playbook activation, decision fusion, or LLM prompts without explicit approval and regression proof.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Load corpora directly into rule engine | Couples authoring to runtime; breaks regression isolation |
| Skill router in pipeline | Speculative orchestration layer (deferred in ADR-004 D3) |
| Hot-reload knowledge into review | No release boundary; audit failure |

### Consequences

- Knowledge value is delivered via visibility, preview, eval stamps — not live runtime mutation.
- Benchmark regression (`9/9`, 97.8% WQS) validates the freeze held through Sprint 5.
- Sprint 6.2 integrates **links** from review UI to knowledge APIs, not pipeline code.

---

## ADR-002: Knowledge-First Architecture

**Status:** Accepted

### Context

AAIRP must compound knowledge assets (regulations, skills, evidence, cases, rewrites) separately from executable rules and LLM behavior.

### Decision

Author and govern knowledge in **typed corpora** under a shared platform SDK. Runtime artifacts (rules, playbooks) remain **downstream consumers**, not authoring surfaces for corpus content.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Expand demo rules as knowledge store | No linkage model, no KQS, no release |
| KOS-only authoring (skip git corpora) | Sprint 5 pilot uses git; KOS convergence is Phase 4 |
| Single monolithic JSON knowledge file | No governance per corpus type |

### Consequences

- Five corpora with shared `knowledge_id` and linkage adapters.
- Clear path: git corpora → Knowledge Pack → visibility / preview / (future) runtime.

---

## ADR-003: Five-Corpus Knowledge Model

**Status:** Accepted

### Context

Different knowledge types answer different questions (law vs review method vs substantiation vs ground truth vs rewrite).

### Decision

Exactly **five** corpus types for V1: `regulation`, `skill`, `evidence`, `rewrite`, `case`. No sixth corpus in V1.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Merge case into benchmark only | Loses verification and linkage governance |
| Separate “rule corpus” | Rules stay runtime demo pack; not authoring corpus |
| Marketing copy corpus | PII risk; out of scope |

### Consequences

- Platform plugins per corpus; uniform validators and dashboards.
- Graph explorer is skill-centric across five types.

---

## ADR-004: Knowledge Pack Release Model

**Status:** Accepted

### Context

Need immutable, fingerprinted release unit connecting corpora to eval and UI without duplicating entry payloads.

### Decision

**Knowledge Pack v2** is the release boundary: corpus fingerprints, counts, KQS summaries, dependency graph, evaluation linkage — **no entry JSON bodies**.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Manifest-only (Sprint 3 style) | Insufficient governance and graph snapshot |
| Embed full corpus in pack | Duplication, huge artifacts, stale copies |
| Release per corpus independently | No single “what is live” answer |

### Consequences

- UI and preview stamp `knowledge_pack_id` + fingerprint.
- Implements ADR-004 EKS D5/D6 at operational level.

---

## ADR-005: Immutable Release Strategy

**Status:** Accepted

### Context

Compliance audits require knowing exactly what knowledge was active at release time.

### Decision

`release_status: released` packs are **immutable**. Corrections require a new pack ID; supersede chain tracked in registry.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Mutable released manifest | Cannot reproduce eval or UI state |
| Auto-release on merge | No human gate for legal pilot |
| Draft-only forever | No “released” trust signal for reviewers |

### Consequences

- Draft packs show persistent warning in UI.
- Eval reports record pack version per run.

---

## ADR-006: Knowledge Visibility Snapshot Pattern

**Status:** Accepted

### Context

UI must not read raw corpus JSON (bypasses release governance, large payloads, PII risk in cases).

### Decision

`knowledge-visibility.snapshot.json` is the **sole UI data source**, built from pack + platform metrics + embedded graph + improvement queue.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| UI loads corpus files directly | No release filter; reproducibility loss |
| Live API per corpus card | Heavy; couples UI to loaders |
| Embed in admin-ui | Conflates runtime demo with knowledge product |

### Consequences

- `apps/knowledge-ui/` at `/knowledge/`.
- Rebuild snapshot on release: `pnpm knowledge:build-visibility-snapshot`.

---

## ADR-007: Deterministic Preview Boundary

**Status:** Accepted

### Context

Stakeholders want “what knowledge applies” without triggering a second compliance decision.

### Decision

`knowledge-preview.service.ts` performs **deterministic** taxonomy/signal matching and linkage traversal only. Output wording: **“Relevant knowledge found”**. No rule engine, LLM, risk scoring, or PASS/WARN/REJECT.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Re-run rule engine for preview | Duplicates decision; confuses users |
| LLM-enhanced preview | Non-deterministic; blurs boundary |
| Preview inside pipeline | Couples product to runtime |

### Consequences

- Isolation test: no imports from review-pipeline / rule-engine / open-risk.
- S6.2 embeds same API in Review Result (Knowledge Basis panel).

---

## ADR-008: Feedback-Driven Knowledge Improvement

**Status:** Accepted

### Context

Knowledge platform needs operational loop from consumption to improvement.

### Decision

Capture **metadata-only** preview feedback (`yes` / `needs_update`) in append-only JSONL, linked to pack fingerprints. Feed **deterministic gap report** (P1–P5). Feedback is a **signal**, not knowledge.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Store full claim text in feedback | Privacy / retention risk |
| Free-text comments in 5G | Scope creep; moderation burden |
| Auto-edit corpus from feedback | Violates manual release (ADR-010) |

### Consequences

- Lifecycle: Captured → Reviewed → Converted → Implemented → Released (manual stages post-capture).
- Improvement queue on dashboard.

---

## ADR-009: KQS vs Coverage Separation

**Status:** Accepted

### Context

“Quality” and “coverage” are often conflated in dashboards, hiding different improvement actions.

### Decision

Display **KQS** (governance/freshness per corpus) separately from **benchmark case coverage** (% cases with `benchmark_ref`).

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Single “health score” | Masks whether to fix governance vs add cases |
| Coverage-only metric | Ignores validation warnings and stale entries |

### Consequences

- Dashboard: corpus cards (KQS) + quality vs coverage section.
- Gap report P3/P5 address different dimensions.

---

## ADR-010: Manual Knowledge Release Authority

**Status:** Accepted

### Context

Legal and compliance stakeholders must approve what knowledge is “live.”

### Decision

Pack release is **manual CLI** (`pnpm knowledge:release-knowledge-pack`) with human `released_by`. No UI release button or CI auto-publish in V1.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Auto-release on green CI | Legal gate bypass |
| UI one-click release | Accidental release risk without checklist |
| No released state (draft only) | Pilot cannot distinguish approved knowledge |

### Consequences

- Draft warning when no released pack.
- Release checklist in V1-READINESS-REVIEW.

---

## ADR-011: Product Shell vs Platform (S6.2)

**Status:** Accepted

### Context

Sprint 5 delivered separate surfaces (`review-ui`, `knowledge-ui`). V1 product requires one journey without merging codebases or semantics.

### Decision

**Review Workspace** is the primary product shell. **Knowledge Basis** is an embedded panel calling the existing preview API with the same claim text. Knowledge platform services remain isolated; integration is **client-side + REST** only.

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Merge knowledge-ui into review-ui repo immediately | Premature coupling; different release cadence |
| Extend `/demo/review` response with knowledge | Violates preview boundary; bloats runtime DTO |
| iframe knowledge-ui inside review | Awkward auth/layout; poor UX |

### Consequences

- `knowledge-basis.js` in review-ui (S6.2 prototype).
- Deep links to Explorer (`?tab=explorer&skill=…`).
- Future unified nav without monolith refactor.

---

## Maintenance

- New ADRs require: Context, Decision, Alternatives, Consequences, Status.
- Superseded ADRs keep history; mark **Superseded by ADR-NNN**.
- Do not renumber; append new IDs.
