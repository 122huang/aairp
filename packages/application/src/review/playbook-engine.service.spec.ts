import { describe, expect, it } from 'vitest';
import type { CaseReviewContext, ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { PlaybookEngineService } from '../review/playbook-engine.service.js';

const baseContext: ReviewContext = {
  reviewId: 'rev_test',
  advertisementId: 'ad_test',
  contentHash: 'hash123',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'META',
    categoryId: 'health.supplement',
  },
  normalizedContent: {
    text: 'Limited time offer! Only 3 left in stock. Buy now!',
    imageUrls: [],
  },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-06-26T10:05:00.000Z',
};

const caseReviewContext: CaseReviewContext = {
  caseIds: ['case_a', 'case_b'],
  precedentSummaries: [
    '- case_id=case_a; decision=REJECT; status=CONFIRMED; similarity=0.91; summary',
    '- case_id=case_b; decision=REJECT; status=CONFIRMED; similarity=0.88; summary',
  ],
  sharedRuleRefs: [],
  regulationCitations: [],
  humanOverrideNotes: [],
  coverageScore: 0.91,
  exactContentHashMatch: false,
  hasConfirmedExactMatch: true,
  coldStart: false,
};

describe('PlaybookEngineService case augmentation', () => {
  it('boosts confidence and adds casePrecedentHint when case context is provided', () => {
    const service = new PlaybookEngineService({
      createFindingId: () => '11111111-1111-1111-1111-111111111111',
    });

    const baseline = service.evaluate(baseContext);
    const augmented = service.evaluate(baseContext, { caseReviewContext });

    expect(baseline.findings.length).toBeGreaterThan(0);
    expect(augmented.findings.length).toBe(baseline.findings.length);
    expect(augmented.findings[0]!.confidence).toBeGreaterThan(baseline.findings[0]!.confidence);
    expect(augmented.findings[0]!.evaluationDetail?.casePrecedentHint).toContain('CONFIRMED');
  });

  it('fires match_mode:link patterns from prior rule findings without duplicate keywords', () => {
    const service = new PlaybookEngineService({
      playbookMarkdown: `# T
pack_version: t
playbook_id: t

## sa-social-proof-claim
match_mode: link
linked_rules: demo-apac-sa-social-proof-claim
decision: WARN
guidance: Social proof guidance only
typical_decision: REVIEW
scope_countries: SG
scope_categories: electronics
`,
      createFindingId: () => '22222222-2222-2222-2222-222222222222',
    });

    const context: ReviewContext = {
      ...baseContext,
      dimensions: { ...baseContext.dimensions, categoryId: 'electronics' },
      normalizedContent: { text: 'Trusted by thousands of households this year.', imageUrls: [] },
    };

    const withoutPrior = service.evaluate(context);
    expect(withoutPrior.findings).toHaveLength(0);

    const withPrior = service.evaluate(context, {
      priorRuleFindings: [
        {
          refId: 'demo-apac-sa-social-proof-claim',
          evaluationDetail: {
            matchedSpans: [{ field: 'text', start: 0, end: 20, text: 'Trusted by thousands' }],
          },
        },
      ],
    });
    expect(withPrior.findings).toHaveLength(1);
    expect(withPrior.findings[0]!.refId).toBe('sa-social-proof-claim');
    expect(withPrior.findings[0]!.summary).toContain('Social proof');
  });
});
