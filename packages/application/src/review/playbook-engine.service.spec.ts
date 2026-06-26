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
});
