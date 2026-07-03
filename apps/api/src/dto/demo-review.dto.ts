import type { ReviewHappyPathResult } from '@aairp/shared-kernel';
import { toReviewReportResponseDto } from './review-report.dto.js';

export type DemoReviewResponseDto = {
  review_id: string;
  advertisement_id: string;
  final_decision: string;
  confidence: number;
  rationale: string;
  finding_counts: {
    rule: number;
    playbook: number;
    llm: number;
    case?: number;
    vision?: number;
  };
  report_html: string;
  summary: ReturnType<typeof toReviewReportResponseDto>['summary'];
  generated_at: string;
};

export function toDemoReviewResponseDto(result: ReviewHappyPathResult): DemoReviewResponseDto {
  const reportDto = toReviewReportResponseDto(result.report);

  return {
    review_id: result.reviewId,
    advertisement_id: result.advertisementId,
    final_decision: result.decision.finalDecision,
    confidence: result.decision.confidence,
    rationale: result.decision.rationale,
    finding_counts: {
      rule: result.decision.findingCounts.rule,
      playbook: result.decision.findingCounts.playbook,
      llm: result.decision.findingCounts.llm,
      ...(result.decision.findingCounts.case > 0
        ? { case: result.decision.findingCounts.case }
        : {}),
      ...(result.decision.findingCounts.vision > 0
        ? { vision: result.decision.findingCounts.vision }
        : {}),
    },
    report_html: reportDto.report_html,
    summary: reportDto.summary,
    generated_at: reportDto.generated_at,
  };
}
