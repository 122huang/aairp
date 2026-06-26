import { describe, expect, it } from 'vitest';
import { renderAccuracyReportMarkdown } from './eval-report.js';
import type { BenchmarkEvalResult } from './benchmark-types.js';

describe('renderAccuracyReportMarkdown', () => {
  it('includes metrics and explainability section', () => {
    const result: BenchmarkEvalResult = {
      benchmark_id: 'test-benchmark',
      schema_version: '1.0.0',
      evaluated_at: '2026-06-26T12:00:00.000Z',
      manifest_path: '/benchmark/ad-manifest.json',
      failed_case_ids: ['case-fail'],
      metrics: {
        total_cases: 2,
        passed_cases: 1,
        failed_cases: 1,
        decision_accuracy: 0.5,
        blocker_recall: 1,
        false_reject_rate: 0,
        finding_precision: 1,
        finding_recall: 0.5,
        finding_f1: 0.667,
      },
      case_results: [
        {
          case_id: 'case-pass',
          description: 'passes',
          tags: [],
          passed: true,
          expected: { expected_decision: 'PASS' },
          actual: {
            final_decision: 'PASS',
            finding_refs: [],
            open_risk_skipped: false,
            rationale: 'ok',
          },
          failures: [],
        },
        {
          case_id: 'case-fail',
          description: 'fails',
          tags: [],
          passed: false,
          expected: { expected_decision: 'REJECT' },
          actual: {
            final_decision: 'WARN',
            finding_refs: [],
            open_risk_skipped: false,
            rationale: 'warn only',
          },
          failures: ['decision mismatch: expected REJECT, got WARN'],
        },
      ],
    };

    const markdown = renderAccuracyReportMarkdown(result);

    expect(markdown).toContain('Decision Accuracy');
    expect(markdown).toContain('BLOCKER Recall');
    expect(markdown).toContain('Explainability');
    expect(markdown).toContain('case-fail');
    expect(markdown).toContain('warn only');
  });
});
