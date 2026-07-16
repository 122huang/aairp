import type { ReviewReportResult } from '@aairp/shared-kernel';
import { isLegalReviewedMarket } from '@aairp/shared-kernel';

export type GenerateReviewReportRequestDto = {
  advertisement_id: string;
};

export type ReviewReportResponseDto = {
  review_id: string;
  advertisement_id: string;
  report_html: string;
  summary: {
    final_decision: string;
    confidence: number;
    rationale: string;
    finding_counts: {
      rule: number;
      playbook: number;
      llm: number;
      case?: number;
    };
    advertisement: {
      text_preview: string;
      country_id: string;
      platform_id: string;
      category_id: string;
      /**
       * False means country_id has no Legal-written market card yet (demo-level keyword
       * rules only) — see isLegalReviewedMarket in @aairp/shared-kernel. Do not present
       * findings for these markets with the same confidence as an already-reviewed one.
       */
      legal_reviewed_market: boolean;
    };
    findings: Array<{
      finding_id: string;
      module: string;
      ref_id: string;
      severity: string;
      decision: string;
      summary: string;
      evidence_spans?: Array<{
        field: string;
        start?: number;
        end?: number;
        text: string;
      }>;
      rewrite_suggestions?: Array<{
        suggestion_id: string;
        finding_id: string;
        risk_type: string;
        rewrite_template_id: string;
        original_span: {
          field: string;
          start?: number;
          end?: number;
          text: string;
        };
        suggested_text: string[];
        rationale: string;
        confidence: number;
      }>;
    }>;
    open_risk_skipped: boolean;
    open_risk_skip_reason?: string;
  };
  generated_at: string;
};

export function toReviewReportResponseDto(result: ReviewReportResult): ReviewReportResponseDto {
  return {
    review_id: result.reviewId,
    advertisement_id: result.advertisementId,
    report_html: result.reportHtml,
    summary: {
      final_decision: result.summary.finalDecision,
      confidence: result.summary.confidence,
      rationale: result.summary.rationale,
      finding_counts: {
        rule: result.summary.findingCounts.rule,
        playbook: result.summary.findingCounts.playbook,
        llm: result.summary.findingCounts.llm,
        ...(result.summary.findingCounts.case && result.summary.findingCounts.case > 0
          ? { case: result.summary.findingCounts.case }
          : {}),
      },
      advertisement: {
        text_preview: result.summary.advertisement.textPreview,
        country_id: result.summary.advertisement.countryId,
        platform_id: result.summary.advertisement.platformId,
        category_id: result.summary.advertisement.categoryId,
        legal_reviewed_market: isLegalReviewedMarket(result.summary.advertisement.countryId),
      },
      findings: result.summary.findings.map((finding) => ({
        finding_id: finding.findingId,
        module: finding.module,
        ref_id: finding.refId,
        severity: finding.severity,
        decision: finding.decision,
        summary: finding.summary,
        ...(finding.evidenceSpans?.length
          ? {
              evidence_spans: finding.evidenceSpans.map((span) => ({
                field: span.field,
                start: span.start,
                end: span.end,
                text: span.text,
              })),
            }
          : {}),
        ...(finding.rewriteSuggestions?.length
          ? {
              rewrite_suggestions: finding.rewriteSuggestions.map((suggestion) => ({
                suggestion_id: suggestion.suggestionId,
                finding_id: suggestion.findingId,
                risk_type: suggestion.riskType,
                rewrite_template_id: suggestion.rewriteTemplateId,
                original_span: suggestion.originalSpan,
                suggested_text: suggestion.suggestedText,
                rationale: suggestion.rationale,
                confidence: suggestion.confidence,
              })),
            }
          : {}),
      })),
      open_risk_skipped: result.summary.openRiskSkipped,
      open_risk_skip_reason: result.summary.openRiskSkipReason,
    },
    generated_at: result.generatedAt,
  };
}
