import { describe, expect, it } from 'vitest';
import { compareToBaseline, loadBenchmarkV3Baseline } from './benchmark-v3-baseline.js';
import type { BenchmarkV3EvalResult } from './benchmark-v3-evaluator.service.js';

describe('benchmark v3 baseline', () => {
  it('loads frozen baseline artifact', () => {
    const baseline = loadBenchmarkV3Baseline();
    expect(baseline.baseline_id).toBe('benchmark-v3-baseline-2026-06-30');
    expect(baseline.regression_tier.case_count).toBe(9);
    expect(baseline.metrics.weighted_quality_pct).toBe(97.8);
    expect(baseline.metrics.decision_accuracy_pct).toBe(100);
  });

  it('detects stable regression when metrics match baseline', () => {
    const baseline = loadBenchmarkV3Baseline();
    const current = {
      evaluated_at: new Date().toISOString(),
      metrics: {
        weighted_quality_score: baseline.metrics.weighted_quality_score,
        decision_accuracy: baseline.metrics.decision_accuracy,
        module_scores: baseline.module_scores,
        passed_cases: 9,
        total_cases: 9,
      },
      case_results: [],
      failed_case_ids: [],
    } as unknown as BenchmarkV3EvalResult;

    const comparison = compareToBaseline(baseline, current);
    expect(comparison.regression_status).toBe('stable');
  });
});
