import type { PlaybookEvaluationResult, PlaybookFinding } from '@aairp/shared-kernel';

export type EvaluatePlaybookRequestDto = {
  advertisement_id: string;
};

export type PlaybookFindingResponseDto = {
  finding_id: string;
  module: 'PLAYBOOK';
  severity: string;
  decision: string;
  ref_type: 'PLAYBOOK_PATTERN';
  ref_id: string;
  ref_version_id: string;
  summary: string;
  confidence: number;
  evaluation_detail?: {
    pattern_id: string;
    checklist_ids: string[];
    guidance: string;
    severity_hint: string;
    playbook_decision: string;
    typical_decision: string;
    matched_spans?: Array<{
      field: string;
      start: number;
      end: number;
      text: string;
    }>;
  };
};

export type PlaybookEvaluationResponseDto = {
  review_id: string;
  playbook_pack_version: string;
  findings: PlaybookFindingResponseDto[];
  evaluated_at: string;
};

function toPlaybookFindingResponseDto(finding: PlaybookFinding): PlaybookFindingResponseDto {
  return {
    finding_id: finding.findingId,
    module: 'PLAYBOOK',
    severity: finding.severity,
    decision: finding.decision,
    ref_type: 'PLAYBOOK_PATTERN',
    ref_id: finding.refId,
    ref_version_id: finding.refVersionId,
    summary: finding.summary,
    confidence: finding.confidence,
    ...(finding.evaluationDetail
      ? {
          evaluation_detail: {
            pattern_id: finding.evaluationDetail.patternId,
            checklist_ids: finding.evaluationDetail.checklistIds,
            guidance: finding.evaluationDetail.guidance,
            severity_hint: finding.evaluationDetail.severityHint,
            playbook_decision: finding.evaluationDetail.playbookDecision,
            typical_decision: finding.evaluationDetail.typicalDecision,
            ...(finding.evaluationDetail.matchedSpans
              ? { matched_spans: finding.evaluationDetail.matchedSpans }
              : {}),
          },
        }
      : {}),
  };
}

export function toPlaybookEvaluationResponseDto(
  result: PlaybookEvaluationResult,
): PlaybookEvaluationResponseDto {
  return {
    review_id: result.reviewId,
    playbook_pack_version: result.playbookPackVersion,
    findings: result.findings.map(toPlaybookFindingResponseDto),
    evaluated_at: result.evaluatedAt,
  };
}
