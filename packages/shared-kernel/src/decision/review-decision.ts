export type FinalDecision = 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';

export type ReviewFindingCounts = {
  rule: number;
  playbook: number;
  llm: number;
  case: number;
  vision: number;
  consistency?: number;
};

export type BranchVerdicts = {
  text: FinalDecision;
  image: FinalDecision;
  consistency: FinalDecision;
};

export type ReviewDecisionResult = {
  reviewId: string;
  finalDecision: FinalDecision;
  confidence: number;
  rationale: string;
  findingCounts: ReviewFindingCounts;
  decidedAt: string;
  /** Optional multimodal branch breakdown (ADR-005 §7.3). */
  branchVerdicts?: BranchVerdicts;
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
  consistencyFindingCount?: number;
  hasConsistencyWarn?: boolean;
  /**
   * Open Risk fail-soft incomplete — unknown residual risk.
   * Elevates like a REVIEW signal but is not itself an LLM content finding.
   */
  hasOpenRiskIncomplete?: boolean;
};
