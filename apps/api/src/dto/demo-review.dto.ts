import type { CaseRecord, ReviewHappyPathResult } from '@aairp/shared-kernel';
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
  /** Present when case library save succeeded for this review. */
  case_id?: string;
  thread_id?: string;
  parent_case_id?: string;
  reviewer_id?: string;
};

export function toDemoReviewResponseDto(
  result: ReviewHappyPathResult,
  caseRecord?: CaseRecord | null,
): DemoReviewResponseDto {
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
    ...(caseRecord
      ? {
          case_id: caseRecord.case_id,
          ...(caseRecord.thread_id ? { thread_id: caseRecord.thread_id } : {}),
          ...(caseRecord.parent_case_id ? { parent_case_id: caseRecord.parent_case_id } : {}),
          ...(caseRecord.reviewer_id ? { reviewer_id: caseRecord.reviewer_id } : {}),
        }
      : {}),
  };
}

/** Extract optional parent_case_id from a demo review request body without failing upload validation. */
export function extractParentCaseId(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const raw = (body as { parent_case_id?: unknown }).parent_case_id;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
