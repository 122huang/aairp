import { describe, expect, it } from 'vitest';
import { hashForReviewMode, hrefForRoute, resolveAppRoute } from './hash-route';

describe('hash-route', () => {
  it('resolves #/image as image mode', () => {
    expect(resolveAppRoute('#/image')).toEqual({ name: 'image' });
    expect(hrefForRoute({ name: 'image' })).toBe('#/image');
    expect(hashForReviewMode('image')).toBe('#/image');
  });

  it('keeps single and batch routes unchanged', () => {
    expect(resolveAppRoute('#/')).toEqual({ name: 'single' });
    expect(resolveAppRoute('#/batch')).toEqual({ name: 'batch' });
    expect(resolveAppRoute('#/?parent_case_id=case_1')).toEqual({
      name: 'single',
      parentCaseId: 'case_1',
    });
  });
});
