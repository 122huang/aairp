import { describe, expect, it } from 'vitest';
import { experimentalOpenRiskLabel } from './review-runtime';

describe('experimentalOpenRiskLabel', () => {
  it('is visible only for live Open Risk', () => {
    expect(experimentalOpenRiskLabel('live')).toBe('实验性 Open Risk 已启用');
    expect(experimentalOpenRiskLabel('stub')).toBeNull();
    expect(experimentalOpenRiskLabel(undefined)).toBeNull();
  });
});
