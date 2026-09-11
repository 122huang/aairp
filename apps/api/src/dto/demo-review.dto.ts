import type { CaseRecord, ClaimOpinion, ReviewHappyPathResult } from '@aairp/shared-kernel';
import { composeOverallDecision, getReviewRuntimeModes } from '@aairp/application';
import { toReviewReportResponseDto } from './review-report.dto.js';

export type DemoReviewResponseDto = {
  review_id: string;
  advertisement_id: string;
  final_decision: string;
  /** Copy-layer fusion snapshot. Same as final_decision; never rewritten by materials. */
  copy_decision: string;
  /** User-facing conclusion after overlaying material judgment (authenticity assumed). */
  overall_decision: string;
  /** True when overall PASS is because materials covered every open substantiation finding. */
  evidence_cleared: boolean;
  confidence: number;
  rationale: string;
  finding_counts: {
    rule: number;
    playbook: number;
    llm: number;
    case?: number;
    vision?: number;
    consistency?: number;
  };
  branch_verdicts?: {
    text: string;
    image: string;
    consistency: string;
  };
  report_html: string;
  summary: ReturnType<typeof toReviewReportResponseDto>['summary'];
  generated_at: string;
  /** Present when case library save succeeded for this review. */
  case_id?: string;
  thread_id?: string;
  parent_case_id?: string;
  reviewer_id?: string;
  /** Per-claim tool opinion (written Chinese). Always present after a successful review. */
  claim_opinions?: ClaimOpinion[];
  runtime_modes?: ReturnType<typeof getReviewRuntimeModes>;
};

export function toDemoReviewResponseDto(
  result: ReviewHappyPathResult,
  caseRecord?: CaseRecord | null,
  claimOpinions?: ClaimOpinion[],
): DemoReviewResponseDto {
  const reportDto = toReviewReportResponseDto(result.report);
  const opinions = claimOpinions ?? [];
  const overall = composeOverallDecision({
    copyDecision: result.decision.finalDecision,
    findings: result.report.summary.findings,
    opinions,
  });

  return {
    review_id: result.reviewId,
    advertisement_id: result.advertisementId,
    final_decision: result.decision.finalDecision,
    copy_decision: overall.copy_decision,
    overall_decision: overall.overall_decision,
    evidence_cleared: overall.evidence_cleared,
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
      ...(result.decision.findingCounts.consistency &&
      result.decision.findingCounts.consistency > 0
        ? { consistency: result.decision.findingCounts.consistency }
        : {}),
    },
    ...(result.decision.branchVerdicts
      ? { branch_verdicts: result.decision.branchVerdicts }
      : {}),
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
    claim_opinions: opinions,
    runtime_modes: getReviewRuntimeModes(),
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

/** Extract optional entry_mode without failing advertisement upload validation. */
export function extractEntryMode(body: unknown): 'single' | 'batch' | 'image' | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const raw = (body as { entry_mode?: unknown }).entry_mode;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'single' || trimmed === 'batch' || trimmed === 'image') {
    return trimmed;
  }
  return undefined;
}
