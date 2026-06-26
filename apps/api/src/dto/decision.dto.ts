import type { ReviewDecisionResult } from '@aairp/shared-kernel';

export type FuseDecisionRequestDto = {
  advertisement_id: string;
};

export type DecisionResponseDto = {
  review_id: string;
  final_decision: string;
  confidence: number;
  rationale: string;
  finding_counts: {
    rule: number;
    playbook: number;
    llm: number;
    case?: number;
  };
  decided_at: string;
};

export function toDecisionResponseDto(result: ReviewDecisionResult): DecisionResponseDto {
  return {
    review_id: result.reviewId,
    final_decision: result.finalDecision,
    confidence: result.confidence,
    rationale: result.rationale,
    finding_counts: {
      rule: result.findingCounts.rule,
      playbook: result.findingCounts.playbook,
      llm: result.findingCounts.llm,
      ...(result.findingCounts.case > 0 ? { case: result.findingCounts.case } : {}),
    },
    decided_at: result.decidedAt,
  };
}
