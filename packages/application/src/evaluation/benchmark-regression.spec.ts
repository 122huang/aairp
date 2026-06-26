import { describe, expect, it } from 'vitest';
import { runBenchmarkEval } from './benchmark-evaluator.service.js';
import { defaultBenchmarkManifestPath } from './load-benchmark.js';

describe('benchmark regression', () => {
  it('passes regression subset with 100% decision accuracy', async () => {
    const result = await runBenchmarkEval({
      manifestPath: defaultBenchmarkManifestPath(),
      regressionOnly: true,
      writeReports: false,
    });

    expect(result.metrics.total_cases).toBeGreaterThanOrEqual(5);
    expect(result.metrics.decision_accuracy).toBe(1);
    expect(result.metrics.blocker_recall).toBe(1);
    expect(result.failed_case_ids).toEqual([]);
    expect(result.case_results.every((caseResult) => caseResult.passed)).toBe(true);
  });

  it('passes full benchmark manifest', async () => {
    const result = await runBenchmarkEval({
      manifestPath: defaultBenchmarkManifestPath(),
      writeReports: false,
    });

    expect(result.metrics.passed_cases).toBe(result.metrics.total_cases);
    expect(result.metrics.false_reject_rate).toBe(0);
  });
});
