import { describe, expect, it } from 'vitest';
import {
  DEMO_REVIEW_COUNTRIES,
  isLegalReviewedMarket,
  LEGAL_REVIEWED_MARKET_COUNTRY_IDS,
} from './review-dimensions.js';

describe('legal_reviewed market flag', () => {
  it('marks VN and PH as not legal-reviewed on DEMO_REVIEW_COUNTRIES', () => {
    const byId = Object.fromEntries(DEMO_REVIEW_COUNTRIES.map((c) => [c.id, c.legal_reviewed]));
    expect(byId.SG).toBe(true);
    expect(byId.MY).toBe(true);
    expect(byId.TH).toBe(true);
    expect(byId.ID).toBe(true);
    expect(byId.VN).toBe(false);
    expect(byId.PH).toBe(false);
  });

  it('never treats VN/PH as legal-reviewed — flag flips only after Legal ships a market card', () => {
    expect(LEGAL_REVIEWED_MARKET_COUNTRY_IDS.has('VN')).toBe(false);
    expect(LEGAL_REVIEWED_MARKET_COUNTRY_IDS.has('PH')).toBe(false);
    expect(isLegalReviewedMarket('VN')).toBe(false);
    expect(isLegalReviewedMarket('ph')).toBe(false);
    expect(isLegalReviewedMarket('SG')).toBe(true);
  });
});
