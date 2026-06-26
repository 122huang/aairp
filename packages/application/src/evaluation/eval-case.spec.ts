import { describe, expect, it } from 'vitest';
import { compareEvalCase } from './eval-case.js';
import type { BenchmarkGroundTruth, EvalCaseActual } from './benchmark-types.js';

describe('compareEvalCase', () => {
  const expected: BenchmarkGroundTruth = {
    expected_decision: 'REJECT',
    expected_findings: [{ module: 'RULE', ref_id: 'demo-sg-health-forbidden-claim' }],
    open_risk_skipped: true,
  };

  it('passes when actual matches expected', () => {
    const actual: EvalCaseActual = {
      final_decision: 'REJECT',
      finding_refs: [
        { module: 'RULE', ref_id: 'demo-sg-health-forbidden-claim' },
        { module: 'PLAYBOOK', ref_id: 'urgency-cta' },
      ],
      open_risk_skipped: true,
      rationale: 'Rejected due to blocking rule finding',
    };

    const result = compareEvalCase('case-1', 'desc', [], expected, actual);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('fails on decision mismatch with explainability details', () => {
    const actual: EvalCaseActual = {
      final_decision: 'WARN',
      finding_refs: [],
      open_risk_skipped: false,
      rationale: 'Warning issued',
    };

    const result = compareEvalCase('case-2', 'desc', [], expected, actual);
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('decision mismatch');
    expect(result.failures.some((line) => line.startsWith('rationale:'))).toBe(true);
  });

  it('fails when forbidden ref appears', () => {
    const actual: EvalCaseActual = {
      final_decision: 'PASS',
      finding_refs: [{ module: 'RULE', ref_id: 'demo-sg-health-forbidden-claim' }],
      open_risk_skipped: false,
      rationale: 'pass',
    };

    const result = compareEvalCase(
      'case-3',
      'desc',
      [],
      {
        expected_decision: 'PASS',
        must_not_include_refs: ['demo-sg-health-forbidden-claim'],
      },
      actual,
    );

    expect(result.passed).toBe(false);
    expect(result.failures.some((line) => line.includes('unexpected finding ref'))).toBe(true);
  });
});
