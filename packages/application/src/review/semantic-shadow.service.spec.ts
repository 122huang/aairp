import { afterEach, describe, expect, it } from 'vitest';
import {
  resetSemanticShadowSampleCounter,
  resolveSemanticShadowMode,
  semanticShadowDataApproved,
  shouldInvokeSemanticShadow,
} from './semantic-shadow-mode.js';
import { SemanticShadowService } from './semantic-shadow.service.js';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import type { ReviewContext } from '@aairp/shared-kernel';

const previousEnv = { ...process.env };

afterEach(() => {
  process.env = { ...previousEnv };
  resetSemanticShadowSampleCounter();
});

describe('semantic shadow mode', () => {
  it('defaults off and does not follow API key presence', () => {
    delete process.env.AAIRP_SEMANTIC_SHADOW_MODE;
    process.env.DEEPSEEK_API_KEY = 'sk-present';
    expect(resolveSemanticShadowMode()).toBe('off');
    expect(shouldInvokeSemanticShadow()).toBe(false);
  });

  it('sampled respects rate 0', () => {
    process.env.AAIRP_SEMANTIC_SHADOW_MODE = 'sampled';
    process.env.AAIRP_SEMANTIC_SHADOW_SAMPLE_RATE = '0';
    expect(shouldInvokeSemanticShadow(process.env, () => 0.99)).toBe(false);
  });

  it('sampled invokes when random is below rate', () => {
    process.env.AAIRP_SEMANTIC_SHADOW_MODE = 'sampled';
    process.env.AAIRP_SEMANTIC_SHADOW_SAMPLE_RATE = '0.1';
    expect(shouldInvokeSemanticShadow(process.env, () => 0.01)).toBe(true);
  });
});

describe('semantic shadow service fail-open', () => {
  const context: ReviewContext = {
    reviewId: 'rev_shadow',
    advertisementId: 'ad_shadow',
    contentHash: 'h',
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: 'SG',
      platformId: 'SHOPEE',
      categoryId: 'sa.other',
    },
    normalizedContent: { text: 'Rated plate load equals 495 watts.', imageUrls: [] },
    resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
    advertisementContext: {},
    tags: [],
    builtAt: '2026-09-28T00:00:00.000Z',
  };

  it('does not call the provider when production copy is not data-approved', async () => {
    process.env.AAIRP_SEMANTIC_SHADOW_MODE = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'false';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    let called = 0;
    const events: Record<string, unknown>[] = [];
    const service = new SemanticShadowService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => {
        called += 1;
        return { propositions: [] };
      },
    });
    const event = await service.runAndLog(context, { ruleFindings: [], playbookFindings: [] });
    expect(called).toBe(0);
    expect(event.status).toBe('blocked_data');
    expect(event.key).toBe('KEY_PRESENT');
    expect(JSON.stringify(event)).not.toMatch(/sk-test/);
  });

  it('records provider failure without throwing', async () => {
    process.env.AAIRP_SEMANTIC_SHADOW_MODE = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const service = new SemanticShadowService({
      sink: () => undefined,
      gateway: async () => {
        throw new Error('network');
      },
    });
    const event = await service.runAndLog(context, { ruleFindings: [], playbookFindings: [] });
    expect(event.status).toBe('error');
    service.schedule(context, { ruleFindings: [], playbookFindings: [] });
  });
});
