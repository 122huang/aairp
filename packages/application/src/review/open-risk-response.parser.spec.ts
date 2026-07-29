import { describe, expect, it } from 'vitest';
import {
  isOpenRiskParseError,
  parseOpenRiskResponseContent,
} from './open-risk-response.parser.js';

describe('parseOpenRiskResponseContent', () => {
  it('parses a normal findings payload', () => {
    const payload = parseOpenRiskResponseContent(
      JSON.stringify({
        prompt_pack_version: 'demo-open-risk-1.5.5',
        findings: [
          {
            risk_type: 'health-implication',
            description: 'Implied health benefit',
            severity: 'MEDIUM',
            suggested_action: 'WARN',
            confidence: 0.8,
          },
        ],
      }),
    );
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]?.risk_type).toBe('health-implication');
  });

  it('salvages truncated JSON with a complete leading finding', () => {
    const truncated =
      '{"prompt_pack_version":"demo-open-risk-1.5.5","findings":[{"risk_type":"scarcity-urgency-claim","description":"Implied FOMO","severity":"LOW","suggested_action":"WARN","confidence":0.7';
    const payload = parseOpenRiskResponseContent(truncated);
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]?.risk_type).toBe('scarcity-urgency-claim');
  });

  it('throws a parse error when content is not recoverable', () => {
    expect(() => parseOpenRiskResponseContent('not json at all')).toThrow(
      /invalid open risk LLM response/,
    );
  });
});

describe('isOpenRiskParseError', () => {
  it('detects open risk parse failures', () => {
    try {
      parseOpenRiskResponseContent('{}');
    } catch (error) {
      expect(isOpenRiskParseError(error)).toBe(true);
    }
  });
});
