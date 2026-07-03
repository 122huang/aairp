import { describe, expect, it } from 'vitest';
import { computeFreshnessStatus } from './ownership.js';

describe('ownership freshness (E2)', () => {
  const now = new Date('2026-06-30T00:00:00.000Z');

  it('returns current when recently reviewed', () => {
    expect(
      computeFreshnessStatus({
        lastReviewedAt: '2026-06-01T00:00:00.000Z',
        now,
      }),
    ).toBe('current');
  });

  it('returns review_due after 90 days', () => {
    expect(
      computeFreshnessStatus({
        lastReviewedAt: '2026-03-01T00:00:00.000Z',
        now,
      }),
    ).toBe('review_due');
  });

  it('returns stale after 180 days', () => {
    expect(
      computeFreshnessStatus({
        lastReviewedAt: '2025-12-01T00:00:00.000Z',
        now,
      }),
    ).toBe('stale');
  });
});
