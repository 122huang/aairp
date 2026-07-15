export type FinalDecision = 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';

export type ReviewFindingCounts = {
  rule: number;
  playbook: number;
  llm: number;
  case: number;
  vision: number;
};

export type ReviewDecisionResult = {
  reviewId: string;
  finalDecision: FinalDecision;
  confidence: number;
  rationale: string;
  findingCounts: ReviewFindingCounts;
  decidedAt: string;
};

export type DecisionFusionInput = {
  reviewId: string;
  hasBlocker: boolean;
  ruleFindingCount: number;
  playbookFindingCount: number;
  llmFindingCount: number;
  caseFindingCount: number;
  hasRuleWarn: boolean;
  /** Rule finding decision === REVIEW (routes to human / product-compliance). */
  hasRuleReview: boolean;
  /** Playbook finding decision === REVIEW only (CONDITIONAL stays soft WARN). */
  hasPlaybookReviewSignal: boolean;
  /** Playbook CONDITIONAL patterns surface as WARN, not REVIEW. */
  hasPlaybookConditionalSignal: boolean;
  hasLlmManualReviewSignal: boolean;
  hasCaseConfirmedSignal: boolean;
  visionFindingCount: number;
  hasVisionManualReviewSignal: boolean;
};
