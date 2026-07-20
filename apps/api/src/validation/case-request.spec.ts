import { describe, expect, it } from 'vitest';
import { parseCaseSearchQuery } from './case-request.js';

describe('parseCaseSearchQuery', () => {
  it('parses history MVP filters', () => {
    const filters = parseCaseSearchQuery({
      case_id: ' case_abc ',
      thread_id: ' thread_1 ',
      country_id: 'MY',
      final_decision: 'REVIEW',
      created_from: '2026-07-01T00:00:00.000Z',
      created_to: '2026-07-20T23:59:59.999Z',
      limit: '20',
      offset: '0',
    });

    expect(filters).toEqual({
      case_id: 'case_abc',
      thread_id: 'thread_1',
      country_id: 'MY',
      final_decision: 'REVIEW',
      created_from: '2026-07-01T00:00:00.000Z',
      created_to: '2026-07-20T23:59:59.999Z',
      limit: 20,
      offset: 0,
    });
  });

  it('ignores blank case_id / thread_id', () => {
    const filters = parseCaseSearchQuery({
      case_id: '   ',
      thread_id: '',
      country_id: 'SG',
    });
    expect(filters.case_id).toBeUndefined();
    expect(filters.thread_id).toBeUndefined();
    expect(filters.country_id).toBe('SG');
  });
});
