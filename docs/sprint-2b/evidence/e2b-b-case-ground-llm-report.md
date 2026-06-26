# E2B-b — Case-Grounded LLM Completion Report

**Date:** 2026-06-26  
**Sprint:** 2B  
**Epic:** E2B-b  

## Summary

Extended Case First runtime so retrieved precedents **ground the Open Risk LLM prompt** and **tighten guardrails**, without changing Decision fusion (still E2B-c scope).

## Deliverables

### Shared kernel

- `CaseReviewContext` + prompt formatters (`formatCasePrecedentsForPrompt`, `formatRegulationRefsForPrompt`)
- Extended `CaseRetrievalResult` with `exact_content_hash_match`, `coverage_score`, `retrieval_strategy`
- Extended `PriorFindingsSummary.caseReviewContext`
- Extended `LlmEvaluationDetail` with `citedCaseIds`, `citedRuleRefs`
- `OpenRiskDiscoveryResult.skipReason`: `EXACT_HASH_PRECEDENT`
- Flags: `isCaseGroundLlmEnabled()`, `isCaseSkipLlmOnExactHash()`

### Application

- `CaseContextAssembler` — loads full case records, builds precedent summaries + regulation whitelist
- `CaseRetrievalService` — computes coverage score and exact-hash flag
- `ReviewPipelineService` — retrieves cases **before Open Risk** (after Rule + Playbook)
- `renderOpenRiskPrompt` — injects case placeholders
- `applyOpenRiskGuardrails` — requires citations when precedents exist; validates case/rule refs
- `OpenRiskDiscoveryService` — optional skip on confirmed exact-hash match

### Demo asset

- `demo/open-risk.prompt.txt` — case precedent section + citation instructions

## Flags

| Flag | Default when case-first on |
|------|----------------------------|
| `AAIRP_CASE_GROUND_LLM` | `true` |
| `AAIRP_CASE_SKIP_LLM_ON_EXACT_HASH` | `false` |

## Regression guarantee

With `AAIRP_CASE_FIRST_ENABLED=false` (default), pipeline behavior is unchanged from E2B-1.

## Tests added

- `case-context-assembler.service.spec.ts`
- `open-risk-discovery.service.spec.ts` — case prompt, guardrails, exact-hash skip

## Next

- **E2B-c:** CASE module findings in DecisionEngine + Playbook augmentation
