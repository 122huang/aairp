# Sprint 5E — Knowledge Pack / KOS Foundation

**Status:** Implemented (Sprint 5E)  
**Theme:** Operationalize the **knowledge lifecycle** — Git corpora → manifests → immutable Knowledge Pack → eval linkage  
**Master roadmap:** [KNOWLEDGE-ROADMAP-v1.0.md](../knowledge/KNOWLEDGE-ROADMAP-v1.0.md) · [ADR-004 — Executable Knowledge System](../adr/ADR-004-executable-knowledge-system.md)  
**Precedent:** [SPRINT-5D-PLAN.md](./SPRINT-5D-PLAN.md) (Case Corpus complete) · [SPRINT-2A-KOS-ROADMAP.md](../sprint-2a/SPRINT-2A-KOS-ROADMAP.md)

---

## Constraints (non-negotiable)

| Constraint | Implication |
|------------|-------------|
| Runtime pipeline frozen | No changes to `Rule → Playbook → LLM → Decision` |
| No runtime loading | Knowledge Pack is a **release artifact** — not loaded by review API in 5E |
| No automatic production deployment | Pack publish does not promote rules/playbooks to live runtime |
| No LLM prompt generation | Pack metadata only — no prompt assembly from corpora |
| No case ingestion automation | Case Corpus growth remains governed authoring; no bulk archive import |
| No document storage | Evidence `document_ref_spec` remains locator metadata |
| Knowledge Platform Core frozen | Extend via pack assembler + release registry — do not fork corpus plugins |
| Existing corpus contracts preserved | Five corpus schemas and validators remain source of truth |

---

## 1. Strategic context

### 1.1 What Sprint 5D completed

Sprint 5D closed the first **Knowledge Platform loop**:

```
Regulation
    ↓
Rule
    ↓
Skill
    ↓
Rewrite
    ↓
Case validation feedback
```

Evidence remains **orthogonal**:

```
Evidence → substantiation validation → Case verification
```

All five corpora are registered, validated, and manifest-generating:

| Corpus | Entries (pilot) | Manifest |
|--------|----------------:|----------|
| Regulation | 75 | `regulation-corpus.manifest.json` |
| Skill | 5 | `skill-corpus.manifest.json` |
| Rewrite | 9 | `rewrite-corpus.manifest.json` |
| Evidence | 20 | `evidence-corpus.manifest.json` |
| Case | 28 | `case-corpus.manifest.json` |

### 1.2 What is missing today

The legacy `knowledge-pack-manifest.ts` (Sprint 3–4) still assembles a pack from **demo/runtime artifacts**:

- `demo/rules.demo.json`, `demo/playbook.demo.md`
- `skill-modules.json` (pre-corpus skill taxonomy)
- `benchmark-v2.json` / `benchmark-v3.json`
- `case-library/` record count

It does **not** yet snapshot the five corpus manifests, their fingerprints, or cross-corpus dependency health. Roadmap item **5B-4** (corpus fingerprint convergence) was deferred until all corpora existed — that precondition is now met.

### 1.3 Sprint 5E objective

**Do not add a sixth corpus.** Operationalize the lifecycle:

```
Git knowledge source (5 corpora)
        ↓
Per-corpus manifest (existing)
        ↓
Knowledge Pack assembly (new)
        ↓
Release registry (new)
        ↓
Evaluation linkage metadata (new)
```

**Core question answered:** *What exact knowledge snapshot was validated, released, and used for this eval run?*

### 1.4 KOS relationship (foundation only)

| Layer | Role in 5E |
|-------|------------|
| **Git corpora** | Authoring source of truth |
| **Corpus manifests** | Per-corpus fingerprint + KQS + counts |
| **Knowledge Pack** | Immutable composite release unit |
| **KOS** | Operational publish/search layer — **not implemented in 5E** |

5E defines the **pack contract** KOS will eventually publish into. No KOS API changes, no import pipelines.

---

## 2. Knowledge Pack model

### 2.1 Pack identity

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `schema_version` | semver | ✓ | Pack schema version (start `2.0.0`) |
| `knowledge_pack_id` | string | ✓ | Stable release ID, e.g. `kp-2026.07.1` |
| `knowledge_pack_version` | string | ✓ | **Alias** of `knowledge_pack_id` for backward compatibility |
| `knowledge_pack_fingerprint` | hex (64) | ✓ | SHA-256 of canonical pack body (excludes fingerprint field) |
| `platform_version` | semver | ✓ | `KNOWLEDGE_PLATFORM_VERSION` at assembly time |
| `generated_at` | ISO datetime | ✓ | Assembly timestamp |
| `release_status` | enum | ✓ | `draft` · `validated` · `released` · `deprecated` |
| `released_at` | ISO datetime | | Set when `release_status` becomes `released` |
| `released_by` | string | | Owner email or CI actor |
| `supersedes` | string | | Prior `knowledge_pack_id` this release replaces |
| `deprecated_reason` | string | | Required when `release_status: deprecated` |

### 2.2 Included corpora (snapshot block)

Each registered corpus contributes one **corpus snapshot** — not entry payloads:

```json
"corpora": {
  "regulation": {
    "corpus_type": "regulation",
    "manifest_path": "docs/knowledge/regulation-corpus/regulation-corpus.manifest.json",
    "fingerprint": "64490f801dadc376",
    "entry_count": 75,
    "knowledge_quality_score": 90.8,
    "validation": { "errors": 0, "warnings": 28 }
  },
  "skill": { "...": "..." },
  "rewrite": { "...": "..." },
  "evidence": { "...": "..." },
  "case": { "...": "..." }
}
```

**Rules:**

- Pack references corpus **manifest fingerprints**, not individual entry files.
- Pack assembly must load all five corpus plugins via `knowledge-platform.ts`.
- Missing corpus plugin → assembly **error** (not silent omission).

### 2.3 Runtime-adjacent components (reference block)

Demo/runtime artifacts remain **referenced**, not authored, in 5E:

```json
"runtime_components": {
  "rules": {
    "version": "demo-rule-1.5.0",
    "count": 18,
    "source": "demo/rules.demo.json"
  },
  "playbooks": {
    "version": "demo-playbook-1.4.0",
    "playbook_id": "demo-health-supplement-playbook",
    "pattern_count": 13,
    "source": "demo/playbook.demo.md"
  }
}
```

This preserves eval/runtime traceability without conflating demo artifacts with corpus knowledge. A future sprint may split `runtime_components` into a separate **Runtime Pack** — out of scope for 5E.

### 2.4 Dependency graph snapshot

Pack includes a **declarative linkage summary** computed at assembly time:

```json
"dependency_graph": {
  "nodes": {
    "regulation": 75,
    "skill": 5,
    "rewrite": 9,
    "evidence": 20,
    "case": 28,
    "rule": 18
  },
  "edges": {
    "regulation_to_skill": 42,
    "skill_to_rewrite": 9,
    "skill_to_evidence": 12,
    "rewrite_to_case": 0,
    "evidence_to_case": 0,
    "case_to_benchmark": 28
  },
  "orphan_counts": {
    "regulation_without_rule": 0,
    "skill_without_regulation": 0,
    "rewrite_without_skill": 0,
    "case_without_benchmark_ref": 0
  }
}
```

Edges are **counts**, not adjacency lists — keeps pack size bounded. Full linkage detail remains in corpus validators and linkage report.

### 2.5 Composite fingerprint algorithm

```
pack_body = {
  platform_version,
  corpora: { [type]: { fingerprint, entry_count } },  // sorted by corpus_type
  runtime_components,                                   // sorted keys
  evaluation_linkage,                                   // see §5
  dependency_graph_summary: dependency_graph.orphan_counts
}
knowledge_pack_fingerprint = sha256(canonical_json(pack_body))
knowledge_pack_id = kp-{YYYY.MM}.{patch}
```

`patch` = first 6 hex chars of fingerprint **or** monotonic patch counter per month — implementation choice (see §8.3).

### 2.6 Compatibility block

```json
"compatibility": {
  "min_platform_version": "1.0.0",
  "max_platform_version": "1.x",
  "required_corpus_types": ["regulation", "skill", "rewrite", "evidence", "case"],
  "benchmark_min_schema": "3.0.0",
  "linkage_validator_version": "2.0.0"
}
```

Eval and future runtime consumers check compatibility before accepting a pack — no automatic upgrade.

---

## 3. Manifest relationship

### 3.1 Three-layer model

```
Layer 1 — Corpus entries (*.json in docs/knowledge/{corpus}/)
    ↓ load + validate
Layer 2 — Corpus manifest ({corpus}-corpus.manifest.json)
    ↓ assemble
Layer 3 — Knowledge Pack (knowledge-pack.manifest.json + release registry)
```

| Layer | Mutability | Consumer |
|-------|------------|----------|
| Corpus entries | Git history (mutable via PR) | Corpus plugins, validators |
| Corpus manifest | Regenerated on each build | Pack assembler, dashboards |
| Knowledge Pack (released) | **Immutable** once `release_status: released` | Eval reports, CI gates, future runtime |

### 3.2 File layout (proposed)

```
docs/knowledge/
  regulation-corpus/regulation-corpus.manifest.json   # existing
  skill-corpus/skill-corpus.manifest.json           # existing
  rewrite-corpus/rewrite-corpus.manifest.json       # existing
  evidence-corpus/evidence-corpus.manifest.json     # existing
  case-corpus/case-corpus.manifest.json             # existing

benchmark/
  knowledge-pack.manifest.json          # current released pack (pointer)
  knowledge-pack/
    schema/
      knowledge-pack.schema.json
    releases/
      kp-2026.07.000001.json            # immutable release record
      kp-2026.07.000002.json
    drafts/
      knowledge-pack.draft.json         # working assembly (mutable)
```

**Pointer file:** `benchmark/knowledge-pack.manifest.json` remains the **current released** pack for backward compatibility with eval/health tools. Content upgrades from v1 (demo-only) to v2 (corpus-aware).

### 3.3 Assembly workflow

```bash
# Existing — unchanged
pnpm knowledge:build-regulation-corpus-index
pnpm knowledge:build-skill-corpus-index
# ... all five corpora

# New in 5E
pnpm knowledge:assemble-knowledge-pack      # draft assembly
pnpm knowledge:validate-knowledge-pack        # dependency + gate checks
pnpm knowledge:release-knowledge-pack         # promote draft → released (immutable)
```

Assembly always runs **all five corpus validators** before writing draft.

---

## 4. Release lifecycle

### 4.1 States

```
draft
  ↓ validate (gates pass)
validated
  ↓ release (explicit action)
released  ──→  deprecated
```

| Status | Mutable? | Who writes | Visible to eval |
|--------|----------|------------|-----------------|
| `draft` | Yes | `assemble-knowledge-pack` | No |
| `validated` | Yes (re-assemble resets) | `validate-knowledge-pack` | No |
| `released` | **No** | `release-knowledge-pack` | Yes (via pointer) |
| `deprecated` | **No** (append-only reason) | manual / supersede | Historical only |

### 4.2 Immutability rules

1. A `released` pack file is **never edited**. Fixes require a new `knowledge_pack_id`.
2. `supersedes` links form a singly-linked version chain.
3. Deprecation does not delete — it marks `release_status: deprecated` with reason.
4. CI may reject PRs that modify files under `knowledge-pack/releases/`.

### 4.3 Release promotion gates (5E)

| Gate | Tier | Blocks release | Check |
|------|------|:--------------:|-------|
| All corpus validators | T0 | Yes | 0 errors per corpus |
| Platform snapshot | T0 | Yes | 5 corpora registered |
| Cross-corpus linkage | T1 | Yes | Pack dependency validator — 0 errors |
| Corpus KQS floor | T1 | Warn | Per-corpus KQS < 70% → warn; < 50% → block (configurable) |
| Benchmark coverage | — | Warn | Case corpus benchmark % — **never reduces KQS** |
| Regression eval | T2 | Warn in 5E | Eval run optional; block in 5F+ |
| Legal verification | T3 | Warn in 5E | Regression-tier legal % — report only |

**Important (from 5D review):** KQS measures asset quality; benchmark coverage measures domain representation. Pack gates must keep these separate — do not penalize KQS for incomplete benchmark coverage.

---

## 5. Dependency validation

### 5.1 Validation graph (ordered)

Before release, validate the full knowledge chain:

```
Regulation
  ↓ linkage.regulations
Skill
  ↓ linkage.skills
Rewrite
  ↓ linkage.rewrites / rewrite strategy
Evidence
  ↓ linkage.evidence / evidence_requirement
Case
  ↓ benchmark_ref / ground_truth_spec
Benchmark (benchmark-v3 case_id)
```

### 5.2 Pack-level checks (new validator)

| Code | Severity | Check |
|------|----------|-------|
| `missing_corpus_snapshot` | Error | Required corpus not in pack |
| `corpus_fingerprint_mismatch` | Error | Manifest on disk ≠ pack snapshot |
| `stale_corpus_manifest` | Error | Manifest `generated_at` older than entries |
| `broken_regulation_skill_link` | Error | Skill links unknown regulation |
| `broken_skill_rewrite_link` | Error | Rewrite links unknown skill |
| `broken_evidence_requirement` | Error | Skill `evidence_requirement: required` without evidence resolution |
| `broken_case_benchmark_ref` | Error | Case `benchmark_ref` not in benchmark-v3 |
| `missing_evidence_validation` | Error | Evidence-dependent case without `ground_truth_spec.evidence_validation` |
| `deprecated_dependency` | Warn | Linked entry has `deprecated` / `review_status: deprecated` |
| `incompatible_platform_version` | Error | Pack `platform_version` outside compatibility range |
| `asymmetric_cross_corpus_link` | Warn | Existing corpus warn codes aggregated |

Reuse corpus plugin `validate()` results — pack validator **aggregates**, does not duplicate rules.

### 5.3 Rule pack linkage

Rules (`demo/rules.demo.json`) are not a corpus but participate in linkage:

- Pack includes `runtime_components.rules.version` + count.
- Linkage validator (existing) continues to validate rule ↔ skill ↔ benchmark.
- Pack dependency report surfaces rule IDs referenced by corpora but missing from rule pack.

---

## 6. Evaluation linkage

### 6.1 Purpose

Define **release metadata** that eval reports stamp — without modifying eval scoring logic.

### 6.2 `evaluation_linkage` block

```json
"evaluation_linkage": {
  "benchmark": {
    "benchmark_id": "aairp-benchmark-v3",
    "schema_version": "3.0.0",
    "content_fingerprint": "491cfcbd01f4a587...",
    "case_count": 92,
    "source": "benchmark/benchmark-v3.json"
  },
  "case_corpus": {
    "fingerprint": "a1b2c3d4e5f67890",
    "entry_count": 28,
    "benchmark_coverage": {
      "covered": 28,
      "total": 92,
      "pct": 30.4
    },
    "verified_count": 28,
    "regression_count": 0
  },
  "evaluation_profile": {
    "dimensions": ["decision", "pattern_hit", "severity", "action", "rewrite"],
    "default_weights": {
      "decision": 0.35,
      "pattern_hit": 0.2,
      "severity": 0.1,
      "action": 0.15,
      "rewrite": 0.2
    }
  },
  "regression_baseline": {
    "baseline_id": "regression-v3-2026-q2",
    "tier": "regression",
    "case_count": 9,
    "frozen_at": "2026-06-15T00:00:00.000Z"
  }
}
```

### 6.3 Eval report stamping (metadata only)

Existing eval tools (`eval:benchmark-v3`, `eval:module-dashboard`) already read `knowledge_pack_version` from the pointer manifest. In 5E:

| Field added to eval report header | Source |
|-----------------------------------|--------|
| `knowledge_pack_id` | Released pack |
| `knowledge_pack_fingerprint` | Released pack |
| `corpus_fingerprints` | Pack `corpora.*.fingerprint` |
| `case_corpus_fingerprint` | Pack `evaluation_linkage.case_corpus` |
| `benchmark_content_fingerprint` | Pack `evaluation_linkage.benchmark` |

No change to dimension scoring, weights application, or pass/fail thresholds.

### 6.4 Regression result linkage (future-ready)

```json
"last_eval_snapshot": {
  "evaluated_at": null,
  "tier": "regression",
  "weighted_quality": null,
  "knowledge_pack_id": null
}
```

Populated by optional post-eval hook in 5F — **schema reserved in 5E, population deferred**.

---

## 7. Version compatibility

### 7.1 Version layers (unchanged from roadmap §7)

| Layer | Example | Bump trigger |
|-------|---------|--------------|
| Knowledge entry | `regulation:sg-hpa-s7-prohibited-claims` | Entry edit |
| Corpus manifest fingerprint | `64490f801dadc376` | Any entry change |
| Platform SDK | `1.0.0` | Plugin contract change |
| Knowledge Pack | `kp-2026.07.1` | Any corpus fingerprint change |
| Benchmark | `aairp-benchmark-v3` | Generator output change |

### 7.2 Pack schema versioning

| `schema_version` | Meaning |
|------------------|---------|
| `1.x` | Legacy pack (demo components only) — current production |
| `2.0.0` | Five-corpus snapshot + dependency graph + eval linkage |
| `2.x` | Additive fields (backward compatible) |
| `3.0.0` | Breaking — e.g. separate Runtime Pack split |

### 7.3 Consumer compatibility matrix

| Consumer | Reads | 5E behavior |
|----------|-------|-------------|
| `eval:benchmark-v3` | `knowledge_pack_version`, fingerprint | Upgrade to read `corpora` block |
| `eval:module-dashboard` | pack manifest | Stamp corpus fingerprints in header |
| `knowledge:health-report` | ownership, freshness | Add pack release status section |
| `knowledge:validate-linkage` | rule/skill/benchmark | Unchanged; pack aggregates result |
| Review runtime | demo rules/playbook | **Unchanged** — no pack loading |

### 7.4 `knowledge_pack_id` format

```
kp-{YYYY}.{MM}.{patch}
```

| Segment | Rule |
|---------|------|
| `YYYY.MM` | Release month (UTC) |
| `patch` | Monotonic integer per month **or** 6-char fingerprint prefix |

**Recommendation:** Monotonic integer (`kp-2026.07.1`, `kp-2026.07.2`) for human readability; fingerprint provides content identity.

---

## 8. Governance gates

### 8.1 Pre-release checklist

```markdown
## Knowledge Pack Release Checklist

- [ ] All five corpus manifests regenerated
- [ ] All corpus validators: 0 errors
- [ ] Platform dashboard: 5 corpora, 0 validation errors
- [ ] Pack assembly: draft created
- [ ] Pack dependency validator: 0 errors
- [ ] KQS report: per-corpus scores recorded (not averaged into single gate)
- [ ] Benchmark coverage report: recorded separately from KQS
- [ ] Eval linkage block: benchmark + case corpus fingerprints present
- [ ] Release notes: supersedes + summary of corpus changes
- [ ] `release-knowledge-pack` executed — immutable file written
```

### 8.2 CI integration (informational in 5E)

| Job | Trigger | Blocks merge |
|-----|---------|:------------:|
| `validate-corpora` | PR touching `docs/knowledge/` | Yes (existing) |
| `assemble-pack-draft` | PR touching corpora | No — report artifact |
| `validate-pack-draft` | PR touching corpora | Warn only in 5E |
| `block-pack-mutation` | PR editing `releases/*.json` | Yes |

Hard CI gates on pack release promotion deferred to 5F after first released v2 pack exists.

### 8.3 Dashboard additions

Extend `pnpm knowledge:platform-dashboard` with:

| Section | Content |
|---------|---------|
| Pack status | `draft` / `released` / none |
| Corpus fingerprints | 5-column summary |
| Last released pack | `knowledge_pack_id`, date |
| KQS vs coverage | Side-by-side (not combined score) |

---

## 9. Migration impact

### 9.1 From legacy pack manifest (v1)

| v1 field | v2 disposition |
|----------|----------------|
| `knowledge_pack_version` | Retained |
| `knowledge_pack_fingerprint` | Recomputed over v2 body |
| `modules_version` | Moved to `runtime_components.skill_modules` (legacy reference) |
| `components.regulations` (demo count) | Replaced by `corpora.regulation` snapshot |
| `components.rules` | `runtime_components.rules` |
| `components.playbooks` | `runtime_components.playbooks` |
| `components.benchmark_v3` | `evaluation_linkage.benchmark` |
| `components.case_library` | **Removed from pack** — ops layer, not knowledge release |
| `ownership_summary` | Computed from corpus manifests (aggregate) |
| `evaluation_profile` | `evaluation_linkage.evaluation_profile` |

### 9.2 Code migration

| File | Change |
|------|--------|
| `knowledge-pack-manifest.ts` | Refactor → `knowledge-pack-assembler.ts` + `knowledge-pack-validator.ts` |
| `run-knowledge-pack-manifest.ts` | Split into assemble / validate / release runners |
| `linkage-validator.ts` | Read pack `corpora` block when v2 detected |
| `module-eval-dashboard.ts` | Stamp corpus fingerprints when present |
| `knowledge-pack-manifest.spec.ts` | New — v1 backward compat + v2 assembly |

### 9.3 Backward compatibility

- `loadKnowledgePackManifest()` returns v1 or v2 shape via `schema_version`.
- Consumers that only read `knowledge_pack_version` + fingerprint continue working.
- `pnpm knowledge:pack-manifest` aliases to `assemble` + `validate` (draft) until first manual release.

### 9.4 Documentation updates

| Doc | Update |
|-----|--------|
| `KNOWLEDGE-ROADMAP-v1.0.md` | Mark 5B-4 complete after 5E; update §6.3 current state |
| `KNOWLEDGE-AUTHORING-STANDARD.md` | Add §2.6 Knowledge Pack release |
| `ADR-004` | Add v2 pack schema amendment note |
| `docs/sprint-5/README.md` | Add 5E phase row |

### 9.5 No migration required

- Corpus entry JSON files — unchanged
- Corpus plugins — unchanged
- Benchmark fixtures — unchanged
- Runtime demo artifacts — unchanged

---

## 10. Implementation plan

### 10.1 Epic breakdown

| Epic | Scope | Outcome |
|------|-------|---------|
| **E1** | Pack schema | `knowledge-pack.schema.json`, types in `knowledge-pack.ts` |
| **E2** | Assembler | Build draft from five corpus manifests + platform snapshot |
| **E3** | Pack validator | Dependency graph checks; aggregate corpus validation |
| **E4** | Release registry | Immutable `releases/` + pointer update + `supersedes` chain |
| **E5** | CLI runners | `assemble`, `validate`, `release` commands |
| **E6** | Eval linkage | Extend eval report headers; no scoring changes |
| **E7** | Dashboard | Platform dashboard pack section; KQS vs coverage split |
| **E8** | Migration | Refactor legacy `knowledge-pack-manifest.ts`; backward compat |
| **E9** | Tests | Assembly idempotency, immutability, v1 compat, 0-error pilot |
| **E10** | Docs | `KNOWLEDGE-PACK.md`, roadmap update, authoring standard §2.6 |

### 10.2 Explicitly out of scope (5E)

| Item | Deferred to |
|------|-------------|
| Runtime pack loading | 6+ (Runtime Gateway) |
| KOS publish/import of pack | 5F / 6 |
| Automatic production deployment | 6+ |
| LLM prompt generation from pack | 6+ |
| Case ingestion automation | 5D.1+ |
| Document storage / evidence upload | Never in pack layer |
| Sixth corpus | Not planned |
| T2/T3 hard CI block on release | 5F |
| `last_eval_snapshot` population | 5F |

### 10.3 Files to create (planned)

```
docs/knowledge/KNOWLEDGE-PACK.md
benchmark/knowledge-pack/schema/knowledge-pack.schema.json
benchmark/knowledge-pack/releases/               # immutable releases
benchmark/knowledge-pack/drafts/                 # mutable working copy

packages/application/src/knowledge/
  knowledge-pack.ts                              # types + load/release
  knowledge-pack-assembler.ts
  knowledge-pack-validator.ts
  knowledge-pack-release.ts
  run-assemble-knowledge-pack.ts
  run-validate-knowledge-pack.ts
  run-release-knowledge-pack.ts
  knowledge-pack.spec.ts
```

### 10.4 Files to modify (planned)

```
packages/application/src/knowledge/knowledge-pack-manifest.ts   # thin facade → assembler
packages/application/src/knowledge/linkage-validator.ts         # v2 pack awareness
packages/application/src/evaluation/module-eval-dashboard.ts  # corpus fingerprint stamp
packages/application/src/knowledge/platform/knowledge-platform.ts  # pack section helper
packages/application/package.json                             # new scripts
package.json                                                  # root script aliases
docs/knowledge/KNOWLEDGE-ROADMAP-v1.0.md
docs/sprint-5/README.md
```

### 10.5 Commands (after 5E)

```bash
# Corpus manifests (unchanged)
pnpm knowledge:build-regulation-corpus-index
# ... all five

# Knowledge Pack (new)
pnpm knowledge:assemble-knowledge-pack
pnpm knowledge:validate-knowledge-pack
pnpm knowledge:release-knowledge-pack

# Legacy alias
pnpm knowledge:pack-manifest              # → assemble + validate draft

# Dashboard
pnpm knowledge:platform-dashboard       # includes pack status
```

---

## 11. Acceptance criteria

- [x] `knowledge-pack.schema.json` validates v2 pack shape
- [x] Assembler snapshots all five corpus manifests with fingerprints
- [x] Pack validator: 0 errors on current pilot corpora
- [x] Released pack is immutable — mutation attempt fails
- [x] `benchmark/knowledge-pack.manifest.json` updated on manual release
- [x] Eval reports stamp corpus fingerprints when v2 pack present (metadata only)
- [x] KQS and benchmark coverage reported separately in pack dashboard
- [x] Legacy consumers (`knowledge_pack_version` / fingerprint) still work
- [x] No runtime pipeline changes
- [x] All five corpus validators still pass independently (0 errors)

---

## 12. Review disposition (2026-07-01)

**Status:** APPROVED with adjustments — implemented.

| # | Decision | Disposition |
|---|----------|-------------|
| 1 | Monotonic `kp-YYYY.MM.N` ID; fingerprint separate | **Accepted** |
| 2 | T0/T1 block; T2/T3 warn on first release | **Accepted** |
| 3 | `skill-modules.json` legacy reference only | **Accepted** — `runtime_components.legacy_references` |
| 4 | Remove `case_library` from pack | **Accepted** |
| 5 | External `regression_baseline_ref` | **Accepted** — `benchmark-v3-baseline.json` |
| 6 | Manual CLI release only | **Accepted** — `knowledge:release-knowledge-pack` |
| 7 | Dependency graph frozen at release | **Accepted** — `dependency_graph.frozen_at` |
| 8 | Supersedes chain validation | **Accepted** |
| 9 | Corpus compatibility matrix | **Accepted** — `compatibility.required_corpora` |
| 10 | No corpus data duplication in pack | **Accepted** |

### Open questions (resolved)

1. **Pack ID patch strategy:** Monotonic integer per month (`kp-2026.07.1`) vs fingerprint prefix (`kp-2026.07.a1b2c3`)?
2. **First release gate:** Allow `release` with T1 warns only, or require 0 warnings for pilot?
3. **`skill-modules.json`:** Keep in `runtime_components` as legacy reference, or drop from v2 pack entirely now that Skill Corpus exists?
4. **`case_library` count:** Confirm removal from pack — ops metric belongs in health report, not knowledge release?
5. **Regression baseline pointer:** Embed frozen baseline ID in pack, or reference external `benchmark/regression-baseline.json`?
6. **Release authority:** Manual CLI only in 5E, or allow CI bot to `release` on main merge?

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-01 | Initial Sprint 5E plan — Knowledge Pack / KOS foundation (planning only) |
| 2026-07-01 | Sprint 5E implemented — pack v2 assembler, validator, release registry |
