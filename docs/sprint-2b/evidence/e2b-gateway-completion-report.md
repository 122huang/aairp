# E2B-1 — Knowledge Gateway Completion Report

**Date:** 2026-06-26  
**Sprint:** 2B  
**Epic:** E2B-1 / E2B-2 / E2B-3 / E2B-a  

## Summary

Implemented runtime **Knowledge Gateway** so the review pipeline can load published rule/playbook/prompt packs from KOS (or demo files by default), plus **Case First 2B-a** precedent retrieval in reports.

## Deliverables

### Shared kernel

- `packages/shared-kernel/src/knowledge/knowledge-gateway.ts` — `IKnowledgeGateway`, `RuntimeKnowledgeSnapshot`, `resolveKnowledgeSource()`, `isCaseFirstEnabled()`
- `packages/shared-kernel/src/case/case-retrieval.ts` — `CasePrecedent`, `CaseRetrievalResult`

### Application

- `DemoKnowledgeGateway` — file-based loader (default path)
- `PgKosKnowledgeGateway` — PG PUBLISHED export with demo fallback
- `createKnowledgeGateway()` factory
- `createReviewEnginesFromSnapshot()` — injects rule/playbook/prompt into engines
- `bootstrapReviewRuntime()` — single entry for API wiring
- `CaseRetrievalService` — facet + hash precedent search
- `RuleEngineService` — optional `rulePack` dynamic evaluation (hardcoded fallback when absent)
- `PlaybookEngineService` — optional `playbookMarkdown`
- `OpenRiskDiscoveryService` — optional `promptTemplate`
- `ReviewPipelineService` — optional case retrieval before report
- `ReviewReportService` — "Similar Case Precedents" HTML section

### API

- `apps/api/src/app.ts` — uses `bootstrapReviewRuntime()` with shared PG repos

## Flags

| Flag | Default |
|------|---------|
| `AAIRP_KNOWLEDGE_SOURCE` | `demo` |
| `AAIRP_CASE_FIRST_ENABLED` | `false` |

## Regression guarantee

Default flags preserve Sprint 1.5 behavior: demo file snapshot produces the same rule/playbook/open-risk outcomes as hardcoded engines (validated by existing `rule-engine.service.spec.ts` + happy path).

## Tests added

- `demo-knowledge-gateway.spec.ts`
- `case-retrieval.service.spec.ts`

## Next (deferred)

- **E2B-b:** Case-grounded open-risk prompt augmentation
- **E2B-c:** CASE module findings in DecisionEngine
