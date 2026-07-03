import { describe, expect, it } from 'vitest';
import { runGoldenBenchmarkEval } from './golden-benchmark-evaluator.service.js';

describe('runGoldenBenchmarkEval', () => {
  it('passes all runnable text cases against demo/rules.demo.json', async () => {
    const result = await runGoldenBenchmarkEval({ writeReport: false });

    expect(result.summary.runnable).toBe(82);
    expect(result.summary.text_runnable).toBe(61);
    expect(result.summary.image_fixture_runnable).toBe(20);
    expect(result.summary.skipped_multimodal).toBe(2);
    expect(result.summary.miss).toBe(0);
    expect(result.summary.over).toBe(0);
    expect(result.summary.under).toBe(0);
    expect(result.failed_case_ids).toEqual([]);
  });
});
