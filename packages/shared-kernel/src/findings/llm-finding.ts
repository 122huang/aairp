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

/** Intentional Open Risk skip — deterministic path already decisive; LLM was not needed. */
export type OpenRiskSkipReason = 'HAS_BLOCKER' | 'EXACT_HASH_PRECEDENT';

/**
 * Fail-soft incomplete reasons — Open Risk was attempted but could not finish.
 * Distinct from {@link OpenRiskSkipReason}: humans must not treat these as a normal skip.
 */
export type OpenRiskIncompleteReason =
  | 'LLM_UNAVAILABLE'
  | 'LLM_EMPTY_RESPONSE'
  | 'LLM_TIMEOUT'
  | 'LLM_PARSE_FAILED';

export type OpenRiskDiscoveryResult = {
  reviewId: string;
  promptPackVersion: string;
  /** Concrete model id returned by the LLM gateway for this call. */
  model?: string;
  findings: LlmFinding[];
  /** True when Open Risk was intentionally not run (blocker / exact-hash policy). */
  skipped: boolean;
  skipReason?: OpenRiskSkipReason;
  /**
   * True when Open Risk was attempted but failed after retries (fail-soft).
   * Not a content finding — residual risk is unknown; decision fusion treats this as a
   * REVIEW-signal without inventing an LLM REVIEW finding.
   */
  incomplete?: boolean;
  incompleteReason?: OpenRiskIncompleteReason;
  /** Short diagnostic detail for logs/report (not shown as a finding summary). */
  incompleteDetail?: string;
  evaluatedAt: string;
};

export type PriorFindingsSummary = {
  hasBlocker: boolean;
  ruleFindings: Array<{ refId: string; summary: string; severity: string; decision: string }>;
  playbookFindings: Array<{ refId: string; summary: string; decision: string }>;
  caseReviewContext?: CaseReviewContext;
  caseFindings?: CaseFinding[];
};
