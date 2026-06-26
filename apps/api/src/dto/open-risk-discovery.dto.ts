import type { LlmFinding, OpenRiskDiscoveryResult } from '@aairp/shared-kernel';

export type DiscoverOpenRiskRequestDto = {
  advertisement_id: string;
};

export type LlmFindingResponseDto = {
  finding_id: string;
  module: 'LLM';
  severity: string;
  decision: string;
  ref_type: 'LLM_RISK';
  ref_id: string;
  ref_version_id: string;
  summary: string;
  confidence: number;
  evaluation_detail?: {
    risk_type: string;
    suggested_action: string;
    evidence_spans?: Array<{
      field: string;
      start: number;
      end: number;
      text: string;
    }>;
    related_modules_checked?: string[];
  };
};

export type OpenRiskDiscoveryResponseDto = {
  review_id: string;
  prompt_pack_version: string;
  skipped: boolean;
  skip_reason?: string;
  findings: LlmFindingResponseDto[];
  evaluated_at: string;
};

function toLlmFindingResponseDto(finding: LlmFinding): LlmFindingResponseDto {
  return {
    finding_id: finding.findingId,
    module: 'LLM',
    severity: finding.severity,
    decision: finding.decision,
    ref_type: 'LLM_RISK',
    ref_id: finding.refId,
    ref_version_id: finding.refVersionId,
    summary: finding.summary,
    confidence: finding.confidence,
    ...(finding.evaluationDetail
      ? {
          evaluation_detail: {
            risk_type: finding.evaluationDetail.riskType,
            suggested_action: finding.evaluationDetail.suggestedAction,
            ...(finding.evaluationDetail.evidenceSpans
              ? { evidence_spans: finding.evaluationDetail.evidenceSpans }
              : {}),
            ...(finding.evaluationDetail.relatedModulesChecked
              ? { related_modules_checked: finding.evaluationDetail.relatedModulesChecked }
              : {}),
          },
        }
      : {}),
  };
}

export function toOpenRiskDiscoveryResponseDto(
  result: OpenRiskDiscoveryResult,
): OpenRiskDiscoveryResponseDto {
  return {
    review_id: result.reviewId,
    prompt_pack_version: result.promptPackVersion,
    skipped: result.skipped,
    ...(result.skipReason ? { skip_reason: result.skipReason } : {}),
    findings: result.findings.map(toLlmFindingResponseDto),
    evaluated_at: result.evaluatedAt,
  };
}
