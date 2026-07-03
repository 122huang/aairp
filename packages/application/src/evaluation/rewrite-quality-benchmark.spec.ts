import { describe, expect, it } from 'vitest';
import { loadRiskRewriteRoutes } from '../knowledge/risk-rewrite-router.js';
import {
  formatRewriteQualityBenchmarkSummary,
  loadRewriteQualityManifest,
  runRewriteQualityBenchmark,
} from './rewrite-quality-benchmark.js';

describe('rewrite-quality-v1 benchmark (stub)', () => {
  const manifest = loadRewriteQualityManifest();
  const routes = loadRiskRewriteRoutes();

  it('loads 20 cases with zh/en balance and risk_type coverage', () => {
    expect(manifest.cases).toHaveLength(20);
    expect(manifest.cases.filter((item) => item.locale === 'zh')).toHaveLength(10);
    expect(manifest.cases.filter((item) => item.locale === 'en')).toHaveLength(10);

    const riskTypes = new Set(manifest.cases.map((item) => item.risk_type));
    expect(riskTypes.size).toBe(16);

    for (const doubled of [
      'health-implication',
      'unsubstantiated-quantitative-claim',
      'unsupported-comparative-claim',
    ]) {
      expect(manifest.cases.filter((item) => item.risk_type === doubled)).toHaveLength(2);
    }
  });

  it('aligns rewrite_strategy with risk-rewrite-routes', () => {
    const routeByRisk = new Map(routes.routes.map((route) => [route.risk_type, route.strategy]));
    for (const testCase of manifest.cases) {
      expect(testCase.rewrite_strategy, testCase.case_id).toBe(routeByRisk.get(testCase.risk_type));
    }
  });

  it('passes all stub rewrite quality checks including rule-engine self_check', async () => {
    const report = await runRewriteQualityBenchmark(manifest);
    const summary = formatRewriteQualityBenchmarkSummary(report);

    expect(report.failed, summary).toBe(0);
    expect(report.passed + report.warned).toBe(report.total);
  });
});
