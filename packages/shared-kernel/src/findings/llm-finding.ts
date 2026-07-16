import type { CaseReviewContext } from '../case/case-review-context.js';
import type { CaseFinding } from '../findings/case-finding.js';
import type { MatchedSpan, ModuleFinding } from './finding-types.js';

export type LlmSuggestedAction = 'WARN' | 'MANUAL_REVIEW';

export type LlmRiskType = string;

export type LlmEvaluationDetail = {
  riskType: LlmRiskType;
  suggestedAction: LlmSuggestedAction;
  evidenceSpans?: MatchedSpan[];
  relatedModulesChecked?: string[];
  citedCaseIds?: string[];
  citedRuleRefs?: string[];
};

export type LlmFinding = ModuleFinding & {
  module: 'LLM';
  refType: 'LLM_RISK';
  evaluationDetail?: LlmEvaluationDetail;
};

export type OpenRiskDiscoveryResult = {
  reviewId: string;
  promptPackVersion: string;
  /** Concrete model id returned by the LLM gateway for this call. */
  model?: string;
  findings: LlmFinding[];
  skipped: boolean;
  skipReason?: 'HAS_BLOCKER' | 'EXACT_HASH_PRECEDENT';
  evaluatedAt: string;
};

export type PriorFindingsSummary = {
  hasBlocker: boolean;
  ruleFindings: Array<{ refId: string; summary: string; severity: string; decision: string }>;
  playbookFindings: Array<{ refId: string; summary: string; decision: string }>;
  caseReviewContext?: CaseReviewContext;
  caseFindings?: CaseFinding[];
};
