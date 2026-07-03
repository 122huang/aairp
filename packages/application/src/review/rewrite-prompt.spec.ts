import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { loadRiskRewriteRoutes } from '../knowledge/risk-rewrite-router.js';
import {
  DEMO_REWRITE_PROMPT_PACK_VERSION,
  loadRewritePromptTemplate,
  renderRewritePrompt,
} from './rewrite-prompt.service.js';
import { parseRewriteResponseContent } from './rewrite-response.parser.js';

const promptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/rewrite.prompt.txt',
);

const baseContext: ReviewContext = {
  reviewId: 'rev_rewrite_prompt',
  advertisementId: 'ad_rewrite_prompt',
  contentHash: 'hash_rewrite',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'SHOPEE',
    categoryId: 'sa.air_fryer',
  },
  normalizedContent: {
    text: '吃得更轻盈，少油烹饪每一天。',
    imageUrls: [],
  },
  resolvedKnowledgeVersions: {
    rulePackVersion: 'demo-rule-1.7.3',
    playbookVersion: 'demo-playbook-1.0.0',
    promptPackVersion: DEMO_REWRITE_PROMPT_PACK_VERSION,
  },
  advertisementContext: {},
  tags: [],
  builtAt: '2026-06-29T00:00:00.000Z',
};

describe('rewrite prompt (6B-1d)', () => {
  it('loads demo/rewrite.prompt.txt with strategy placeholders', () => {
    const template = loadRewritePromptTemplate(promptPath);
    expect(template).toContain('demo-rewrite-1.0.0');
    expect(template).toContain('{rewrite_strategy}');
    expect(template).toContain('append');
  });

  it('renders prompt with finding and route context', () => {
    const routes = loadRiskRewriteRoutes();
    const route = routes.routes.find((item) => item.risk_type === 'health-implication')!;

    const rendered = renderRewritePrompt(loadRewritePromptTemplate(promptPath), {
      context: baseContext,
      locale: 'zh',
      riskType: route.risk_type,
      rewriteStrategy: route.strategy,
      rewriteTemplateId: route.rewrite_template_id,
      findingRefId: 'demo-apac-sa-health-implication',
      findingSummary: route.risk_type,
      originalSpan: '吃得更轻盈',
    });

    expect(rendered).toContain('吃得更轻盈，少油烹饪每一天。');
    expect(rendered).toContain('health-implication');
    expect(rendered).toContain('remove');
    expect(rendered).not.toContain('{original_span}');
  });

  it('parses valid rewrite LLM JSON response', () => {
    const parsed = parseRewriteResponseContent(
      JSON.stringify({
        prompt_pack_version: DEMO_REWRITE_PROMPT_PACK_VERSION,
        risk_type: 'health-implication',
        rewrite_strategy: 'remove',
        rewrite_template_id: 'remove-health-claim',
        original_span: '吃得更轻盈',
        suggested_text: ['热风循环技术，无需预热，即放即炸。'],
        rationale: '以功能描述替代健康联想措辞。',
        confidence: 0.88,
      }),
    );

    expect(parsed.suggested_text).toHaveLength(1);
    expect(parsed.rationale).toContain('功能描述');
  });
});
