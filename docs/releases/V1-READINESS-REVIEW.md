# AAIRP Knowledge Platform — Version 1 Readiness Review

**Document ID:** V1-READINESS-REVIEW  
**Status:** Approved for internal pilot planning  
**Date:** 2026-07-01  
**Scope:** Knowledge Platform V1 foundation (Sprint 5A–5G complete)  
**Next phase:** Version 1 Stabilization (Sprint 6) — product hardening and deployment, not platform construction

**Related:** [KNOWLEDGE-ROADMAP-v1.0.md](../knowledge/KNOWLEDGE-ROADMAP-v1.0.md) · [SPRINT-5G-PLAN.md](../sprint-5/SPRINT-5G-PLAN.md) · [BASELINE-ISSUES.md](../testing/BASELINE-ISSUES.md)

---

## Executive summary

Sprint **5G** closes the Knowledge Platform operational loop. AAIRP has evolved from a static knowledge repository into a **governed knowledge lifecycle**:

```
Knowledge Creation → Knowledge Release → Knowledge Consumption
        → Feedback Capture → Gap Analysis → Knowledge Improvement → Next Release
```

**Conclusion:** Knowledge Platform **V1 foundation is complete**. Sprint 6 should focus on stabilization, production integration, operational governance, and pilot deployment — not additional corpus types or platform construction.

| Area | V1 readiness |
|------|:------------:|
| Knowledge modeling & governance | **Ready** |
| Release management & traceability | **Ready** |
| User-facing knowledge experience | **Ready (internal pilot)** |
| Feedback & gap analysis | **Ready (pilot)** |
| Runtime review pipeline | **Frozen — stable** |
| Production hardening | **Not ready** — Sprint 6.1 |
| Auth / RBAC / external exposure | **Not ready** — Sprint 6.3 |
| Full test suite green | **Partial** — 3 baseline issues |

**Recommendation:** **Go** for **internal legal pilot** on internal network, with documented constraints. **No-Go** for external or production-grade exposure until Sprint 6.3 items are addressed.

---

## 1. Delivered capabilities

### 1.1 Five-corpus knowledge model

| Corpus | Entries (pilot) | Governance | Status |
|--------|----------------:|------------|--------|
| Regulation | 75 | Validators, KQS, freshness | Complete |
| Skill | 5 review skills | Linkage, drift reports | Complete |
| Rewrite | 20+ | Strategy types, linkage | Complete |
| Evidence | 20+ | Requirement levels | Complete |
| Case | 28 | `benchmark_ref`, verification status | Complete |

**Total governed entries:** 137 (per visibility snapshot, `kp-2026.07.3`).

### 1.2 Platform core (Sprint 5B-E0)

- Shared Knowledge Platform SDK (loaders, validators, coverage, dashboards)
- Corpus plugins with uniform `knowledge_id` + `KnowledgeLinkage`
- Cross-corpus linkage validator
- Knowledge Quality Score (KQS) per corpus

### 1.3 Release management (Sprint 5E)

- Knowledge Pack v2 — immutable release metadata
- Corpus fingerprints, dependency graph snapshot, evaluation linkage
- CLI: assemble → validate → manual release
- Released pack: `kp-2026.07.3`

### 1.4 Visibility & consumption (Sprint 5F)

| Surface | Route | Data boundary |
|---------|-------|---------------|
| Knowledge Dashboard | `/knowledge/` | `knowledge-visibility.snapshot.json` only |
| Graph Explorer | `/knowledge/` (tab) | Skill-centric linkage tree |
| Review Preview | `/knowledge/` + API | Deterministic — no rule engine / LLM |

Product docs: `docs/product/PRD-*.md`  
Engineering docs: `docs/knowledge/KNOWLEDGE-VISIBILITY.md`

### 1.5 Feedback & improvement loop (Sprint 5G)

| Capability | Implementation |
|------------|----------------|
| Preview feedback | `POST /api/knowledge/preview/feedback` → JSONL |
| Gap report | `pnpm knowledge:coverage-gap-report` |
| Improvement queue | Dashboard section (`improvement_queue` in snapshot) |
| Eval linkage | Pack ID + fingerprints + baseline on every feedback/gap artifact |

**Current improvement queue (deterministic):**

| Priority | Count | Meaning |
|----------|------:|---------|
| P1 | 63 | Regulation linkage / orphan regulations |
| P2 | 0 | Evidence mapping gaps |
| P3 | 0 | Unmatched / benchmark gaps |
| P4 | 0 | Low-confidence mapping |
| P5 | 3 | Freshness / governance |

### 1.6 Evaluation traceability

| Metric | Baseline | Post–5G |
|--------|----------|-----------|
| Regression tier | 9/9 | **9/9 pass** |
| Weighted quality | 97.8% | **97.8%** |
| Decision accuracy | 100% | **100%** |
| Regression status | stable | **stable** |

**Frozen baseline report:** `reports/eval-v3-2026-07-01T05-51-15-747Z.json`  
**Command:** `pnpm eval:benchmark-v3 -- --tier=regression`

Every future knowledge release must answer:

1. **What changed in knowledge?** (pack fingerprint diff)
2. **Did evaluation behavior change?** (regression tier comparison)

### 1.7 Architecture validated

```
Knowledge Assets
    ↓
Knowledge Governance (validators, KQS, linkage)
    ↓
Knowledge Release (Knowledge Pack)
    ↓
Knowledge Visibility (snapshot → knowledge-ui)
    ↓
Evaluation Traceability (benchmark stamps)
    ↓
Feedback & Gap Analysis (5G loop)
```

**Frozen runtime principle:** Knowledge Platform additions did **not** alter review pipeline behavior. Confirmed by benchmark regression.

---

## 2. Remaining technical debt

### 2.1 Tracked baseline test failures (must fix in Sprint 6.1 — explicit scope)

See [BASELINE-ISSUES.md](../testing/BASELINE-ISSUES.md). **3 failures** in full application test suite (271/274 pass).

| Issue | Module | Sprint 6 owner |
|-------|--------|----------------|
| Word-boundary offset (`cure` start index) | `content-matching` | S6.1 review pipeline |
| `embeddingProvider is not defined` | `case-retrieval` | S6.1 case-first |
| Open-risk REJECT downgrade | `open-risk-discovery` | S6.1 review pipeline |

**Policy:** Fixes require explicit sprint scope, regression comparison, and owner confirmation. Do not fix opportunistically.

### 2.2 API package build errors (pre-existing)

`@aairp/api` TypeScript build reports errors unrelated to knowledge work:

- `AdvertisementContext.productSku` / `aiRenderedImage` DTO mismatches
- `sharp` namespace in OCR module

Does not block knowledge-ui static serving or knowledge API routes when API runs via `tsx`. Must be resolved in **S6.1 platform hardening**.

### 2.3 Knowledge content debt (operational, not blocking pilot)

| Item | Current state | Target |
|------|---------------|--------|
| P1 regulation linkage gaps | 63 items in queue | Incremental corpus PRs |
| Case benchmark coverage | ~30% (pack metric) | Expand with eval owner |
| Benchmark regression tier size | 9 cases | Expand before T3 merge-block |
| Feedback lifecycle | `captured` only | Manual triage → Sprint 6.3 workflow |

### 2.4 Deferred platform features (intentional — not V1 debt)

| Item | Deferred to |
|------|-------------|
| Runtime Knowledge Pack loading | Sprint 6.2+ |
| Preview API authentication | Sprint 6.3 |
| KOS feedback sync | Sprint 6.3+ |
| ML gap prioritization | Not planned |
| Sixth corpus type | Not planned for V1 |
| Gap report cross-pack diff UI | Sprint 6.3 (compare JSON artifacts manually until then) |

---

## 3. Baseline issues

### 3.1 Test baseline

| Suite | Status |
|-------|--------|
| Knowledge layer (5F + 5G) | All pass |
| Benchmark v3 regression | 9/9, stable |
| Benchmark v3 baseline spec | Pass |
| Benchmark regression spec | Pass |
| Full `pnpm --filter @aairp/application test` | 271/274 (3 baseline) |

### 3.2 Evaluation baseline

| Artifact | ID / path |
|----------|-----------|
| Benchmark baseline | `benchmark-v3-baseline-2026-06-30` |
| Regression eval snapshot | `reports/eval-v3-2026-07-01T05-51-15-747Z.json` |
| Active Knowledge Pack | `kp-2026.07.3` |

### 3.3 Gap report baseline (for future comparison)

Run after each pack release:

```bash
pnpm knowledge:coverage-gap-report
```

Store `reports/knowledge-gap-*.json` alongside pack release notes. Future releases should compare gap counts across pack versions.

---

## 4. Production readiness assessment

### 4.1 Ready for internal pilot

| Capability | Assessment |
|------------|------------|
| Knowledge Dashboard | Ready — static snapshot, rebuild on release |
| Graph Explorer | Ready — read-only, skill-centric |
| Review Preview | Ready — deterministic, disclaimer, draft banner |
| Feedback capture | Ready — metadata-only JSONL |
| Gap report & queue | Ready — deterministic CLI |
| Pack release workflow | Ready — manual CLI with gates |
| Eval regression gate | Ready — automated command |

### 4.2 Not ready for production / external

| Gap | Risk | Sprint 6 workstream |
|-----|------|---------------------|
| No API authentication on preview/feedback | Unauthorized access if exposed | S6.3 |
| JSONL feedback store (local filesystem) | No HA, no backup policy | S6.3 |
| No RBAC on knowledge surfaces | Role confusion | S6.3 |
| Manual pack release only | Human error risk | S6.3 automation |
| API `tsc` build failures | Deploy fragility | S6.1 |
| No structured observability | Incident blind spots | S6.3 |
| Runtime not consuming Knowledge Pack | Review and knowledge are separate surfaces | S6.2 (by design until integrated) |

### 4.3 Deployment model (pilot)

| Component | Pilot approach |
|-----------|----------------|
| knowledge-ui | Static files via API (`/knowledge/`) |
| Preview API | Same API host, internal network |
| Feedback | Append-only JSONL under `reports/feedback/` |
| Corpus authoring | Git + CLI validators |
| Pack release | Manual `pnpm knowledge:release-knowledge-pack` |

---

## 5. Security review

### 5.1 Pilot posture (approved for 5F/5G)

- **Internal network only** — preview and feedback APIs open without API key
- **No claim text in feedback persistence** — `claim_text_hash` only
- **No document upload** in knowledge layer
- **Draft pack warning** — non-dismissible when pack not released

### 5.2 Risks before external exposure

| Risk | Severity | Mitigation (S6.3) |
|------|----------|-------------------|
| Unauthenticated preview API | High (if public) | API key / SSO |
| Feedback JSONL on disk | Medium | Encrypted store, retention policy, access control |
| Visibility snapshot in public dir | Low | Snapshot contains no ad text; metadata only |
| Reviewer role header spoofing | Low | Replace header with authenticated identity |
| No audit log integration | Medium | Wire feedback to KOS audit or SIEM |

### 5.3 Privacy boundary (enforced in 5G)

**Stored:** metadata, knowledge references, eval references, claim hash  
**Not stored:** ad copy, customer materials, uploaded documents, free-text reasoning

See [KNOWLEDGE-FEEDBACK-LOOP.md](../knowledge/KNOWLEDGE-FEEDBACK-LOOP.md).

### 5.4 Security go/no-go

| Environment | Go? |
|-------------|:---:|
| Developer workstation | Yes |
| Internal corporate network | **Yes** (pilot) |
| VPN-only staging | Yes, after S6.1 API build fix |
| Internet-facing production | **No** until S6.3 |

---

## 6. Performance considerations

### 6.1 Current characteristics

| Operation | Profile | Notes |
|-----------|---------|-------|
| Visibility snapshot build | ~1–2s | Loads all corpora + graph; acceptable for CI/release |
| Gap report | ~1s | Deterministic scan; 66 backlog items |
| Preview API | Sub-second | No LLM; corpus lookup only |
| knowledge-ui | Static | No client framework; snapshot JSON ~MB scale |
| Benchmark regression | ~15–20s | Full pipeline per case; 9-case tier |

### 6.2 Scaling limits (V1)

| Limit | Threshold | Mitigation if exceeded |
|-------|-----------|------------------------|
| Corpus entries | ~500 per type | Snapshot build time; consider incremental graph |
| Graph nodes | ~500+ | HTML tree still OK; canvas deferred |
| Feedback JSONL | ~10k lines | Rotate / archive; move to DB in S6.3 |
| Concurrent preview API | Untested | Load test in S6.1 |

### 6.3 Performance actions (Sprint 6.1)

- [ ] Benchmark snapshot build in CI (warn threshold)
- [ ] API cold-start and preview p95 measurement
- [ ] Feedback file rotation policy
- [ ] Optional: cache visibility snapshot in memory at API start

---

## 7. Operational procedures

### 7.1 Knowledge release checklist

```
1. Corpus changes merged to main
2. pnpm knowledge:validate-* (all five corpora) — 0 errors
3. pnpm knowledge:assemble-knowledge-pack
4. pnpm knowledge:validate-knowledge-pack — passed
5. pnpm eval:benchmark-v3 -- --tier=regression — 9/9 stable
6. pnpm knowledge:release-knowledge-pack (manual — sets released_by)
7. pnpm knowledge:coverage-gap-report (record artifact)
8. pnpm knowledge:build-visibility-snapshot
9. Tag release notes with pack ID + fingerprint + gap summary
```

### 7.2 Daily / pilot operations

| Task | Command / action |
|------|------------------|
| View knowledge health | Open `/knowledge/` Dashboard |
| Preview a claim | Review Preview tab or `pnpm knowledge:preview` |
| Submit feedback | Yes / Needs update on preview result |
| Triage improvement queue | Dashboard queue → gap report markdown |
| Check regression | `pnpm eval:benchmark-v3 -- --tier=regression` |

### 7.3 Governance flow

```
Knowledge Engineering → Legal Pilot Review → Evaluation Owner → Manual Release
```

- No autonomous knowledge publishing
- Feedback lifecycle beyond `captured` is manual until S6.3 workflow tooling

### 7.4 Incident / rollback

| Scenario | Procedure |
|----------|-----------|
| Bad pack released | Release superseding pack; do not mutate released pack |
| Regression degraded | Block release; diff pack fingerprint vs last good eval |
| Preview misleading | Draft banner if draft pack; fix corpus; no runtime rollback needed |
| Feedback store corruption | JSONL is append-only; truncate bad lines; restore from backup |

### 7.5 Documentation map

| Audience | Location |
|----------|----------|
| Engineering | `docs/knowledge/` |
| Product | `docs/product/` |
| Testing baseline | `docs/testing/BASELINE-ISSUES.md` |
| Sprint history | `docs/sprint-5/` |
| Release readiness | `docs/releases/` (this document) |

---

## 8. Go / No-Go criteria — internal legal pilot

### 8.1 Go criteria (all required)

| # | Criterion | Status |
|---|-----------|--------|
| G1 | Five corpora validated with 0 validator errors | **Met** |
| G2 | Released Knowledge Pack active (`kp-2026.07.3`) | **Met** |
| G3 | Knowledge UI accessible at `/knowledge/` | **Met** |
| G4 | Preview disclaimer + draft banner enforced | **Met** |
| G5 | Feedback metadata-only (no claim text storage) | **Met** |
| G6 | Benchmark regression 9/9 stable | **Met** |
| G7 | Baseline issues documented and unchanged | **Met** |
| G8 | Internal network access only (documented) | **Met** |
| G9 | Legal pilot training materials / walkthrough | **S6.4** |
| G10 | Release checklist communicated to knowledge eng | **Met** (§7.1) |

**Pilot Go decision:** **Conditional Go** — proceed with internal pilot when S6.4 training is scheduled. Platform foundation criteria (G1–G8) are met.

### 8.2 No-Go criteria (any triggers block)

| # | Criterion |
|---|-----------|
| N1 | Benchmark regression degraded vs baseline |
| N2 | Released pack validation errors > 0 |
| N3 | Preview API exposed to public internet without auth |
| N4 | Claim text or ad materials persisted in feedback store |
| N5 | Runtime pipeline modified without regression proof |
| N6 | Undocumented baseline test failures increased |

### 8.3 Sprint 6 workstream mapping

| Workstream | Focus |
|------------|-------|
| **S6.1** Platform hardening | API build fix, baseline test resolution, performance |
| **S6.2** Production integration | Knowledge links from review results; preserve runtime isolation |
| **S6.3** Operational governance | Auth, RBAC, release automation, audit exports, retention |
| **S6.4** Pilot deployment | Legal users, training, usability feedback, release cadence |

---

## 9. Version 1 declaration

| Statement | |
|-----------|---|
| **Knowledge Platform V1 foundation** | **Complete** (Sprint 5A–5G) |
| **Sprint 5.x** | **Closed** — no further platform construction sprints |
| **Sprint 6** | Stabilization and deployment — not new corpus types |
| **Next milestone** | Internal legal pilot on governed knowledge loop |

---

## 10. Sign-off record

| Role | Decision | Date |
|------|----------|------|
| Knowledge platform | V1 foundation complete | 2026-07-01 |
| Sprint 5G | Accepted | 2026-07-01 |
| Internal pilot | Conditional Go (pending S6.4 training) | 2026-07-01 |

**Prepared for:** Sprint 6 planning kickoff  
**Maintainer:** Knowledge engineering + eval owner
