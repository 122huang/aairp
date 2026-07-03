import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { DEMO_KNOWLEDGE_VERSIONS } from '../packages/application/dist/review/context-builder.service.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stubs = JSON.parse(
  readFileSync(join(root, 'docs/knowledge/contextual-rewrite-stubs.json'), 'utf8'),
);
const routes = JSON.parse(
  readFileSync(join(root, 'docs/knowledge/risk-rewrite-routes.json'), 'utf8'),
);

const routeByRisk = new Map(routes.routes.map((route) => [route.risk_type, route]));

function contextFor(riskType, text) {
  const base = {
    reviewId: 'rev_stub_check',
    advertisementId: 'ad_stub_check',
    contentHash: 'hash_stub',
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: 'SG',
      platformId: 'SHOPEE',
      categoryId: 'sa.air_fryer',
    },
    normalizedContent: { text, imageUrls: [] },
    resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
    advertisementContext: {},
    tags: [],
    builtAt: '2026-06-29T00:00:00.000Z',
  };

  if (riskType === 'health-superlative-claim' || riskType === 'sponsored-disclosure') {
    return {
      ...base,
      dimensions: { ...base.dimensions, categoryId: 'health.supplement' },
    };
  }
  if (riskType === 'market-ranking-claim') {
    return {
      ...base,
      dimensions: { ...base.dimensions, countryId: 'MY' },
    };
  }
  if (riskType === 'ai-image-disclaimer') {
    return {
      ...base,
      normalizedContent: { text, imageUrls: ['https://example.com/product.jpg'] },
      advertisementContext: { aiRenderedImage: true },
    };
  }
  if (riskType === 'sku-mismatch') {
    return {
      ...base,
      advertisementContext: { productSku: 'RC40' },
      normalizedContent: {
        text,
        imageUrls: [],
        ocrText: 'Model 50H100 stainless steel',
      },
    };
  }
  return base;
}

const engine = new RuleEngineService();
const failures = [];

for (const [riskType, locales] of Object.entries(stubs.stubs)) {
  const route = routeByRisk.get(riskType);
  const watchedRuleIds = new Set(route?.rule_ids ?? []);

  for (const locale of ['zh', 'en']) {
    for (const [index, variant] of (locales[locale] ?? []).entries()) {
      const result = engine.evaluate(contextFor(riskType, variant.text));
      const routeHits = result.findings.filter((f) => watchedRuleIds.has(f.refId));
      const allHits = result.findings.map((f) => f.refId);

      if (routeHits.length > 0) {
        failures.push({
          riskType,
          locale,
          index,
          text: variant.text,
          routeHits: routeHits.map((f) => ({
            refId: f.refId,
            matched: f.evaluationDetail?.matchedSpans?.[0]?.text,
          })),
          crossRuleHits: allHits.filter((id) => !watchedRuleIds.has(id)),
        });
      }
    }
  }
}

if (failures.length === 0) {
  console.log('PASS: all stub rewrite texts are clean');
} else {
  console.log(`FAIL: ${failures.length} stub variant(s) trigger rule findings`);
  console.log(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
