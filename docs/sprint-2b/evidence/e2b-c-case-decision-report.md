# E2B-c — CASE Findings + Playbook Augmentation Report

**Date:** 2026-06-26  
**Sprint:** 2B  
**Epic:** E2B-c  

## Summary

Completed Case First runtime integration: **CASE module findings** (flag-gated) and **Playbook precedent augmentation**, completing Sprint 2B.

## Deliverables

### Shared kernel

- `CaseFinding`, `CaseEvaluationResult` types
- `ReviewFindingCounts.case` field on decision/report payloads
- `DecisionFusionInput.caseFindingCount`, `hasCaseConfirmedSignal`
- Flags: `isCaseInPlaybookEnabled()`, `isCaseFindingsInDecisionEnabled()`
- `PlaybookEvaluationDetail.casePrecedentHint`

### Application

- `CaseFindingGeneratorService` — groups CONFIRMED precedents into CASE findings
- `PlaybookEngineService.evaluate(context, options?)` — confidence boost from precedents
- `DecisionEngineService` — fuses optional `caseFindings[]` (WARN only; never REJECT alone)
- `ReviewPipelineService` — reordered: Rule → Case → Playbook → Open Risk → Decision
- Report HTML — Case Findings section + case count in summary

### API DTOs

- Optional `finding_counts.case` in decision/demo/report responses when > 0

## Flags

| Flag | Default | Effect |
|------|---------|--------|
| `AAIRP_CASE_IN_PLAYBOOK` | `true` | Playbook confidence boost |
| `AAIRP_CASE_FINDINGS_IN_DECISION` | `false` | CASE findings in fusion |

## Fusion weights (when enabled)

`RULE BLOCKER` > `RULE WARN` > `CASE (CONFIRMED)` ≈ 0.82 confidence tier > `PLAYBOOK` > `LLM`

## Regression guarantee

All Case First flags off (default) → identical behavior to pre-2B pipeline.

## Tests added

- `case-finding-generator.service.spec.ts`
- `playbook-engine.service.spec.ts` (case augmentation)
- `decision-engine.service.spec.ts` (case-confirmed WARN)

## Sprint 2B complete

Epics E2B-1 through E2B-c are done. **Sprint 2C vector retrieval** is documented in [../sprint-2c/SPRINT-2C-VECTOR-ROADMAP.md](../sprint-2c/SPRINT-2C-VECTOR-ROADMAP.md).
