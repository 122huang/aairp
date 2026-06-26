import { describe, expect, it } from 'vitest';
import { computeEvalMetrics } from './eval-metrics.js';
import type { EvalCaseResult } from './benchmark-types.js';

function makeCase(
  caseId: string,
  expectedDecision: 'PASS' | 'WARN' | 'REJECT',
  actualDecision: 'PASS' | 'WARN' | 'REJECT',
  expectedFindings: EvalCaseResult['expected']['expected_findings'] = [],
  actualFindings: EvalCaseResult['actual']['finding_refs'] = [],
): EvalCaseResult {
  return {
    case_id: caseId,
    description: caseId,
    tags: [],
    passed: expectedDecision === actualDecision,
    expected: { expected_decision: expectedDecision, expected_findings: expectedFindings },
    actual: {
      final_decision: actualDecision,
      finding_refs: actualFindings,
      open_risk_skipped: false,
      rationale: '',
    },
    failures: [],
  };
}

describe('computeEvalMetrics', () => {
  it('computes decision accuracy and blocker recall', () => {
    const results: EvalCaseResult[] = [
      makeCase('reject-ok', 'REJECT', 'REJECT'),
      makeCase('pass-ok', 'PASS', 'PASS'),
      makeCase('warn-fp-reject', 'WARN', 'REJECT'),
    ];

    const metrics = computeEvalMetrics(results);

    expect(metrics.total_cases).toBe(3);
    expect(metrics.decision_accuracy).toBeCloseTo(2 / 3);
    expect(metrics.blocker_recall).toBe(1);
    expect(metrics.false_reject_rate).toBeCloseTo(0.5);
  });

  it('computes finding f1 when findings match', () => {
    const results: EvalCaseResult[] = [
      makeCase(
        'finding-match',
        'WARN',
        'WARN',
        [{ module: 'RULE', ref_id: 'demo-sg-health-superlative' }],
        [{ module: 'RULE', ref_id: 'demo-sg-health-superlative' }],
      ),
    ];

    const metrics = computeEvalMetrics(results);
    expect(metrics.finding_precision).toBe(1);
    expect(metrics.finding_recall).toBe(1);
    expect(metrics.finding_f1).toBe(1);
  });
});
