import type { ReviewReportResult } from '@aairp/shared-kernel';

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
    };
    findings: Array<{
      module: string;
      ref_id: string;
      severity: string;
      decision: string;
      summary: string;
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
      },
      findings: result.summary.findings.map((finding) => ({
        module: finding.module,
        ref_id: finding.refId,
        severity: finding.severity,
        decision: finding.decision,
        summary: finding.summary,
      })),
      open_risk_skipped: result.summary.openRiskSkipped,
      open_risk_skip_reason: result.summary.openRiskSkipReason,
    },
    generated_at: result.generatedAt,
  };
}
