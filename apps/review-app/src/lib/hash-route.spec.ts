import { describe, expect, it } from 'vitest';
import { hrefForRoute, resolveAppRoute } from './hash-route';

describe('hash-route', () => {
  it('resolves history, case detail, batch, and parent_case_id restore', () => {
    expect(resolveAppRoute('#/history')).toEqual({ name: 'history' });
    expect(resolveAppRoute('#/batch')).toEqual({ name: 'batch' });
    expect(resolveAppRoute('#/cases/case_abc')).toEqual({ name: 'case', caseId: 'case_abc' });
    expect(resolveAppRoute('#/cases/case%2Fencoded')).toEqual({
      name: 'case',
      caseId: 'case/encoded',
    });
    expect(resolveAppRoute('#/?parent_case_id=case_parent')).toEqual({
      name: 'single',
      parentCaseId: 'case_parent',
    });
    expect(resolveAppRoute('#/')).toEqual({ name: 'single' });
  });

  it('builds hrefs used by history → detail → resubmit flow', () => {
    expect(hrefForRoute({ name: 'history' })).toBe('#/history');
    expect(hrefForRoute({ name: 'case', caseId: 'case_1' })).toBe('#/cases/case_1');
    expect(hrefForRoute({ name: 'single', parentCaseId: 'case_1' })).toBe(
      '#/?parent_case_id=case_1',
    );
    expect(hrefForRoute({ name: 'single' })).toBe('#/');
  });
});
