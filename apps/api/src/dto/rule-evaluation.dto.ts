import type { RuleEvaluationResult, RuleFinding } from '@aairp/shared-kernel';

export type EvaluateRulesRequestDto = {
  advertisement_id: string;
};

export type RuleFindingResponseDto = {
  finding_id: string;
  module: 'RULE';
  severity: string;
  decision: string;
  ref_type: 'RULE';
  ref_id: string;
  ref_version_id: string;
  summary: string;
  confidence: number;
  evaluation_detail?: {
    matched_spans?: Array<{
      field: string;
      start: number;
      end: number;
      text: string;
    }>;
    citation?: {
      law_name: string;
      article?: string;
      url?: string;
    };
  };
};

export type RuleEvaluationResponseDto = {
  review_id: string;
  rule_pack_version: string;
  has_blocker: boolean;
  findings: RuleFindingResponseDto[];
  evaluated_at: string;
};

function toRuleFindingResponseDto(finding: RuleFinding): RuleFindingResponseDto {
  return {
    finding_id: finding.findingId,
    module: 'RULE',
    severity: finding.severity,
    decision: finding.decision,
    ref_type: 'RULE',
    ref_id: finding.refId,
    ref_version_id: finding.refVersionId,
    summary: finding.summary,
    confidence: finding.confidence,
    ...(finding.evaluationDetail
      ? {
          evaluation_detail: {
            ...(finding.evaluationDetail.matchedSpans
              ? { matched_spans: finding.evaluationDetail.matchedSpans }
              : {}),
            ...(finding.evaluationDetail.citation
              ? {
                  citation: {
                    law_name: finding.evaluationDetail.citation.lawName,
                    ...(finding.evaluationDetail.citation.article
                      ? { article: finding.evaluationDetail.citation.article }
                      : {}),
                    ...(finding.evaluationDetail.citation.url
                      ? { url: finding.evaluationDetail.citation.url }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}

export function toRuleEvaluationResponseDto(
  result: RuleEvaluationResult,
): RuleEvaluationResponseDto {
  return {
    review_id: result.reviewId,
    rule_pack_version: result.rulePackVersion,
    has_blocker: result.hasBlocker,
    findings: result.findings.map(toRuleFindingResponseDto),
    evaluated_at: result.evaluatedAt,
  };
}
