import { describe, expect, it } from 'vitest';
import { buildHistorySearchParams, toCreatedFrom, toCreatedTo } from './history-filters';

describe('history-filters', () => {
  it('converts local date inputs to inclusive ISO bounds', () => {
    expect(toCreatedFrom('')).toBeUndefined();
    expect(toCreatedTo('')).toBeUndefined();
    expect(toCreatedFrom('2026-07-01')).toBe(new Date('2026-07-01T00:00:00').toISOString());
    expect(toCreatedTo('2026-07-20')).toBe(new Date('2026-07-20T23:59:59.999').toISOString());
  });

  it('builds search params for case_id / thread_id / country / decision / dates', () => {
    const params = buildHistorySearchParams({
      caseId: ' case_abc ',
      threadId: ' thread_1 ',
      countryId: 'MY',
      decision: 'REVIEW',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-20',
    });

    expect(params).toEqual({
      case_id: 'case_abc',
      thread_id: 'thread_1',
      country_id: 'MY',
      final_decision: 'REVIEW',
      created_from: new Date('2026-07-01T00:00:00').toISOString(),
      created_to: new Date('2026-07-20T23:59:59.999').toISOString(),
      limit: 50,
      offset: 0,
    });
  });

  it('omits blank optional filters', () => {
    expect(
      buildHistorySearchParams({
        caseId: '  ',
        threadId: '',
        countryId: '',
        decision: '',
        dateFrom: '',
        dateTo: '',
      }),
    ).toEqual({ limit: 50, offset: 0 });
  });
});
