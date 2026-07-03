import { describe, expect, it } from 'vitest';
import {
  VisionScenarioStubGateway,
  extractImageUrlFromVisionPrompt,
  resolveVisionScenarioStubPath,
} from './vision-scenario-stub.gateway.js';

describe('VisionScenarioStubGateway', () => {
  it('resolves stub path from fixture image URL basename', () => {
    const path = resolveVisionScenarioStubPath(
      'fixture://image-compliance/cn-panel-unreplaced-pos.jpg',
    );

    expect(path).toContain('cn-panel-unreplaced-pos.json');
  });

  it('returns positive stub findings for benchmark fixture URL', async () => {
    const gateway = new VisionScenarioStubGateway();
    const prompt = [
      'Image URL: fixture://image-compliance/competitor-logo-pos.jpg',
      'Country: SG',
    ].join('\n');

    const response = await gateway.complete(prompt);
    const parsed = JSON.parse(response.content) as { findings: Array<{ risk_type: string }> };

    expect(parsed.findings.map((finding) => finding.risk_type)).toEqual([
      'unauthorised-competitor-trademark',
    ]);
  });

  it('extracts image URL from rendered vision prompt', () => {
    expect(
      extractImageUrlFromVisionPrompt('Image URL: fixture://image-compliance/ai-no-disclaimer-neg.jpg'),
    ).toBe('fixture://image-compliance/ai-no-disclaimer-neg.jpg');
  });
});
