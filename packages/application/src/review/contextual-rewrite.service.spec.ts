import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RuleFinding } from '@aairp/shared-kernel';
import { ContextualRewriteService } from './contextual-rewrite.service.js';

function createRuleFinding(partial: Partial<RuleFinding> & Pick<RuleFinding, 'refId' | 'summary'>): RuleFinding {
  return {
    module: 'RULE',
    findingId: 'rf_test',
    severity: 'MEDIUM',
    decision: 'WARN',
    refType: 'RULE',
    refVersionId: `${partial.refId}-v1`,
    confidence: 1,
    ...partial,
    refId: partial.refId,
    summary: partial.summary,
  };
}

describe('ContextualRewriteService', () => {
  const previousMode = process.env.AAIRP_REWRITE_MODE;

  beforeEach(() => {
    process.env.AAIRP_REWRITE_MODE = 'stub';
  });

  afterEach(() => {
    if (previousMode === undefined) {
      delete process.env.AAIRP_REWRITE_MODE;
    } else {
      process.env.AAIRP_REWRITE_MODE = previousMode;
    }
  });

  const service = new ContextualRewriteService({
    createSuggestionId: () => '00000000-0000-0000-0000-000000000001',
  });

  it('skips with REWRITE_MODE_OFF when mode is off', async () => {
    const offService = new ContextualRewriteService({ mode: 'off' });
    const result = await offService.suggest({
      reviewId: 'rev_test',
      adText: '少油烹饪，让您吃得更轻盈无负担。',
      finding: createRuleFinding({
        refId: 'demo-apac-sa-health-implication',
        summary: 'Health implication detected',
      }),
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('REWRITE_MODE_OFF');
  });

  it('skips BLOCKER findings', async () => {
    const result = await service.suggest({
      reviewId: 'rev_test',
      adText: 'Clinically proven to cure diabetes.',
      finding: createRuleFinding({
        refId: 'demo-apac-sa-health-claim-blocker',
        summary: 'Medical claim blocked',
        severity: 'BLOCKER',
        decision: 'FAIL',
      }),
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('BLOCKER_FINDING');
  });

  it('returns zh rewrite suggestion for health-implication RULE finding in stub mode', async () => {
    const adText = '少油烹饪，让您吃得更轻盈无负担。';
    const result = await service.suggest({
      reviewId: 'rev_test',
      adText,
      locale: 'zh',
      finding: createRuleFinding({
        refId: 'demo-apac-sa-health-implication',
        summary: 'Health implication detected',
        evaluationDetail: {
          matchedSpans: [{ field: 'text', start: 10, end: 14, text: '更轻盈' }],
        },
      }),
    });

    expect(result.skipped).toBe(false);
    expect(result.suggestion).toMatchObject({
      suggestionId: 'rs_00000000-0000-0000-0000-000000000001',
      findingId: 'rf_test',
      riskType: 'health-implication',
      rewriteTemplateId: 'remove-health-claim',
      originalSpan: { field: 'text', start: 10, end: 14, text: '更轻盈' },
      confidence: 0.82,
    });
    expect(result.suggestion?.suggestedText.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestion?.suggestedText.length).toBeLessThanOrEqual(3);
  });

  it('returns en rewrite suggestion for comparative claim in stub mode', async () => {
    const adText = 'Quieter by design than ordinary blenders.';
    const result = await service.suggest({
      reviewId: 'rev_test',
      adText,
      locale: 'en',
      finding: createRuleFinding({
        refId: 'demo-apac-sa-comparative-claim',
        summary: 'Unsupported comparative claim',
        evaluationDetail: {
          matchedSpans: [{ field: 'text', start: 0, end: 18, text: 'Quieter by design' }],
        },
      }),
    });

    expect(result.skipped).toBe(false);
    expect(result.suggestion?.riskType).toBe('unsupported-comparative-claim');
    expect(result.suggestion?.rewriteTemplateId).toBe('qualify-comparative');
    expect(result.suggestion?.suggestedText[0]).toContain('previous-generation');
  });
});
