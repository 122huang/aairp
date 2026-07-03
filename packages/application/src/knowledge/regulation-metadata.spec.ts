import { describe, expect, it } from 'vitest';
import { DEMO_REGULATION_SEEDS } from './demo-knowledge-paths.js';

describe('Regulation metadata (E6)', () => {
  it('includes optional metadata on demo regulation seeds', () => {
    for (const seed of DEMO_REGULATION_SEEDS) {
      expect(seed.effectiveDate).toBeTruthy();
      expect(typeof seed.mandatory).toBe('boolean');
      expect(seed.riskLevel).toBeTruthy();
    }
  });
});
