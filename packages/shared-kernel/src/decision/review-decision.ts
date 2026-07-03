export type FinalDecision = 'PASS' | 'WARN' | 'REJECT';

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
  hasPlaybookReviewSignal: boolean;
  hasLlmManualReviewSignal: boolean;
  hasCaseConfirmedSignal: boolean;
  visionFindingCount: number;
  hasVisionManualReviewSignal: boolean;
};
