import { describe, expect, it } from 'vitest';
import { toReviewReportResponseDto } from './review-report.dto.js';

describe('review-report.dto', () => {
  it('maps ReviewReportResult to snake_case response', () => {
    const dto = toReviewReportResponseDto({
      reviewId: 'rev_test',
      advertisementId: 'ad_test',
      reportHtml: '<html>report</html>',
      summary: {
        finalDecision: 'REJECT',
        confidence: 1,
        rationale: 'Rule BLOCKER finding requires rejection.',
        findingCounts: { rule: 1, playbook: 1, llm: 0 },
        advertisement: {
          textPreview: 'Sample ad text',
          countryId: 'SG',
          platformId: 'META',
          categoryId: 'health.supplement',
        },
        findings: [
          {
            findingId: 'rf_blocker',
            module: 'RULE',
            refId: 'demo-sg-health-forbidden-claim',
            severity: 'BLOCKER',
            decision: 'FAIL',
            summary: 'Forbidden claim',
          },
        ],
        openRiskSkipped: true,
        openRiskSkipReason: 'HAS_BLOCKER',
      },
      generatedAt: '2026-06-26T10:10:00.000Z',
    });

    expect(dto).toEqual({
      review_id: 'rev_test',
      advertisement_id: 'ad_test',
      report_html: '<html>report</html>',
      summary: {
        final_decision: 'REJECT',
        confidence: 1,
        rationale: 'Rule BLOCKER finding requires rejection.',
        finding_counts: { rule: 1, playbook: 1, llm: 0 },
        advertisement: {
          text_preview: 'Sample ad text',
          country_id: 'SG',
          platform_id: 'META',
          category_id: 'health.supplement',
          legal_reviewed_market: true,
        },
        findings: [
          {
            finding_id: 'rf_blocker',
            module: 'RULE',
            ref_id: 'demo-sg-health-forbidden-claim',
            severity: 'BLOCKER',
            decision: 'FAIL',
            summary: 'Forbidden claim',
          },
        ],
        open_risk_skipped: true,
        open_risk_skip_reason: 'HAS_BLOCKER',
      },
      generated_at: '2026-06-26T10:10:00.000Z',
    });
  });

  it('flags legal_reviewed_market false for markets without a legal market card (e.g. VN/PH)', () => {
    const dto = toReviewReportResponseDto({
      reviewId: 'rev_vn',
      advertisementId: 'ad_vn',
      reportHtml: '<html>report</html>',
      summary: {
        finalDecision: 'PASS',
        confidence: 1,
        rationale: 'No findings.',
        findingCounts: { rule: 0, playbook: 0, llm: 0 },
        advertisement: {
          textPreview: 'Sample ad text',
          countryId: 'VN',
          platformId: 'META',
          categoryId: 'sa.air_fryer',
        },
        findings: [],
        openRiskSkipped: false,
      },
      generatedAt: '2026-06-26T10:10:00.000Z',
    });

    expect(dto.summary.advertisement.legal_reviewed_market).toBe(false);
  });
});
