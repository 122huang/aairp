import { describe, expect, it } from 'vitest';
import {
  buildRuleIdToRiskTypeIndex,
  listWarnRiskTypes,
  loadRiskRewriteRoutes,
  resolveRewriteTemplateId,
} from './risk-rewrite-router.js';

describe('risk-rewrite-router', () => {
  const doc = loadRiskRewriteRoutes();

  it('covers all 16 WARN-layer risk types', () => {
    expect(listWarnRiskTypes(doc)).toHaveLength(16);
    expect(listWarnRiskTypes(doc)).toContain('absolute-claim-soft');
    expect(listWarnRiskTypes(doc)).toContain('ai-image-disclaimer');
    expect(listWarnRiskTypes(doc)).not.toContain('medical-claim');
    expect(listWarnRiskTypes(doc)).not.toContain('absolute-claim-blocker');
  });

  it('defines four rewrite strategies', () => {
    expect(doc.strategy_definitions).toMatchObject({
      remove: expect.any(String),
      qualify: expect.any(String),
      substantiate: expect.any(String),
      rephrase: expect.any(String),
      append: expect.any(String),
    });
    for (const route of doc.routes) {
      expect(['remove', 'qualify', 'substantiate', 'rephrase', 'append']).toContain(route.strategy);
    }
  });

  it('maps risk_type to rewrite_template_id', () => {
    const routes = new Map(doc.routes.map((route) => [route.risk_type, route]));
    expect(resolveRewriteTemplateId('health-implication', routes)).toBe('remove-health-claim');
    expect(resolveRewriteTemplateId('ai-image-disclaimer', routes)).toBe('disclose-ai');
    expect(resolveRewriteTemplateId('medical-claim', routes)).toBeUndefined();
  });

  it('resolves rule_id to risk_type for RULE findings', () => {
    const ruleIndex = buildRuleIdToRiskTypeIndex(doc);
    expect(ruleIndex.get('demo-apac-sa-absolute-claim-soft')).toBe('absolute-claim-soft');
    expect(ruleIndex.get('demo-apac-sa-ai-image-disclaimer')).toBe('ai-image-disclaimer');
    expect(ruleIndex.get('demo-apac-sa-health-claim-blocker')).toBeUndefined();
  });
});
