# Sprint 2B — Runtime Knowledge Gateway + Case First (2B-a)

Sprint 2B connects the review pipeline to **published KOS knowledge** at runtime and adds **Case First** precedent retrieval to reports (decision unchanged).

## Epics

| Epic | Scope | Status |
|------|-------|--------|
| **E2B-1** | `IKnowledgeGateway` + demo/KOS loaders | ✅ |
| **E2B-2** | Engine injection (rule / playbook / open-risk) | ✅ |
| **E2B-3** | `bootstrapReviewRuntime` wiring in API | ✅ |
| **E2B-a** | Case precedent retrieval → report only | ✅ |
| **E2B-b** | Case-grounded LLM prompt + guardrails | ✅ |
| **E2B-c** | CASE findings in Decision + Playbook augmentation | ✅ |

## Environment flags

| Variable | Values | Default | Effect |
|----------|--------|---------|--------|
| `AAIRP_KNOWLEDGE_SOURCE` | `demo` \| `kos` | `demo` | Runtime knowledge loader |
| `AAIRP_CASE_FIRST_ENABLED` | `true` / `false` | `false` | Case retrieval + report precedents |
| `AAIRP_CASE_GROUND_LLM` | `true` / `false` | `true` (when case-first on) | Inject precedents into Open Risk prompt |
| `AAIRP_CASE_SKIP_LLM_ON_EXACT_HASH` | `true` / `false` | `false` | Skip LLM when exact hash + CONFIRMED precedent |
| `AAIRP_CASE_IN_PLAYBOOK` | `true` / `false` | `true` (when case-first on) | Boost Playbook confidence from precedents |
| `AAIRP_CASE_FINDINGS_IN_DECISION` | `true` / `false` | `false` | CASE module participates in Decision fusion |

### `demo` (default)

Loads `demo/rules.demo.json`, `demo/playbook.demo.md`, `demo/open-risk.prompt.txt` via `DemoKnowledgeGateway`. Behavior matches Sprint 1.5 hardcoded engines (rules driven from JSON asset).

### `kos`

Loads **PUBLISHED** packs from PostgreSQL:

- Rule pack key: `demo-rules`
- Playbook pack key: `demo-health-supplement-playbook`
- Prompt pack key: `demo-open-risk` / template `open-risk-discovery`

If KOS data is missing, falls back to demo files (logged as `source: demo`).

**Prerequisite:** run `pnpm kos:import-demo` after migrate.

## Architecture

```
bootstrapReviewRuntime()
  ├─ createKnowledgeGateway(AAIRP_KNOWLEDGE_SOURCE)
  │    ├─ DemoKnowledgeGateway  (files)
  │    └─ PgKosKnowledgeGateway (PG → fallback demo)
  ├─ createReviewEnginesFromSnapshot(snapshot)
  │    ├─ RuleEngineService({ rulePack })
  │    ├─ PlaybookEngineService({ playbookMarkdown })
  │    └─ OpenRiskDiscoveryService({ promptTemplate })
  └─ CaseRetrievalService (if AAIRP_CASE_FIRST_ENABLED)
       ├─ CaseContextAssembler → Open Risk prompt (if AAIRP_CASE_GROUND_LLM)
       └─ report HTML "Similar Case Precedents" section
```

### Case-grounded LLM (E2B-b)

When `AAIRP_CASE_FIRST_ENABLED=true` and `AAIRP_CASE_GROUND_LLM=true` (default):

1. After Rule + Playbook, retrieve precedents and assemble `CaseReviewContext`
2. Open Risk prompt receives `{case_precedents_summary}`, `{known_regulation_refs}`, `{shared_rule_refs}`
3. Guardrails require `evidence_spans` plus `cited_case_ids` / `cited_rule_refs` when precedents exist
4. Optional `AAIRP_CASE_SKIP_LLM_ON_EXACT_HASH=true` skips LLM when exact content hash matches a CONFIRMED case

**Decision unchanged in 2B-b** — guardrails only filter LLM findings; fusion weights unchanged.

### Case findings + Playbook boost (E2B-c)

Pipeline order when case-first is enabled:

```
Rule → Case Retrieve → Playbook (+ case boost) → Open Risk → Decision (+ CASE when flagged)
```

- `CaseFindingGeneratorService` — produces `module=CASE` findings from CONFIRMED precedents (similarity ≥ 0.75, non-PASS)
- `AAIRP_CASE_IN_PLAYBOOK=true` — boosts Playbook finding confidence + `casePrecedentHint`
- `AAIRP_CASE_FINDINGS_IN_DECISION=true` — CASE WARN findings participate in fusion (confidence 0.82 tier; never REJECT alone)
- Rule BLOCKER still wins; default flags keep Decision identical to Sprint 1.5

**Hard constraint preserved:** With default flags (`demo`, case-first off), `POST /demo/review` and benchmark regression remain behavior-identical.

## Case First 2B-a

- Retrieves up to 5 precedents by content hash (exact) or country/category/platform facets.
- Injected into **report only** — `DecisionEngineService` unchanged.
- Scoring: exact hash = 1.0; facet match = 0.5–0.75; `CONFIRMED` cases get +0.1.

## Verification

```powershell
pnpm test
pnpm eval:benchmark -- --regression

# Optional KOS runtime (requires DB + import)
$env:AAIRP_KNOWLEDGE_SOURCE='kos'
pnpm kos:import-demo
pnpm dev:api

# Case First report section
$env:AAIRP_CASE_FIRST_ENABLED='true'
pnpm dev:api
```

## Evidence

- [E2B-1 Gateway completion](./evidence/e2b-gateway-completion-report.md)
- [E2B-b Case-grounded LLM](./evidence/e2b-b-case-ground-llm-report.md)
- [E2B-c CASE in Decision](./evidence/e2b-c-case-decision-report.md)
