import { describe, expect, it } from 'vitest';
import { toDemoReviewResponseDto } from './demo-review.dto.js';

describe('demo-review.dto', () => {
  it('maps ReviewHappyPathResult to snake_case response', () => {
    const dto = toDemoReviewResponseDto({
      reviewId: 'rev_test',
      advertisementId: 'ad_test',
      decision: {
        reviewId: 'rev_test',
        finalDecision: 'REJECT',
        confidence: 1,
        rationale: 'Rule BLOCKER finding requires rejection.',
        findingCounts: { rule: 1, playbook: 1, llm: 0, case: 0, vision: 0 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      report: {
        reviewId: 'rev_test',
        advertisementId: 'ad_test',
        reportHtml: '<html>report</html>',
        summary: {
          finalDecision: 'REJECT',
          confidence: 1,
          rationale: 'Rule BLOCKER finding requires rejection.',
          findingCounts: { rule: 1, playbook: 1, llm: 0, case: 0, vision: 0 },
          advertisement: {
            textPreview: 'Sample ad text',
            countryId: 'SG',
            platformId: 'META',
            categoryId: 'health.supplement',
          },
          findings: [],
          openRiskSkipped: true,
          openRiskSkipReason: 'HAS_BLOCKER',
        },
        generatedAt: '2026-06-26T10:10:00.000Z',
      },
    });

    expect(dto).toEqual({
      review_id: 'rev_test',
      advertisement_id: 'ad_test',
      final_decision: 'REJECT',
      confidence: 1,
      rationale: 'Rule BLOCKER finding requires rejection.',
      finding_counts: { rule: 1, playbook: 1, llm: 0 },
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
        findings: [],
        open_risk_skipped: true,
        open_risk_skip_reason: 'HAS_BLOCKER',
      },
      generated_at: '2026-06-26T10:10:00.000Z',
    });
  });
});
