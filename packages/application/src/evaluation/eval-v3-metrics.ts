import type { BenchmarkV3Case } from './load-benchmark-v3.js';

export type V3EvalCaseActual = {
  final_decision: string;
  pattern_ids: string[];
  severities: string[];
  action: string;
  rewrite_text: string;
};

export type V3DimensionScores = {
  decision: number;
  pattern_hit: number;
  severity: number;
  action: number;
  rewrite: number;
};

export type V3EvalCaseResult = {
  case_id: string;
  expected_skill: string;
  tier: string;
  weight: number;
  passed: boolean;
  dimension_scores: V3DimensionScores;
  weighted_score: number;
  failures: string[];
  expected: Pick<
    BenchmarkV3Case,
    'expected_decision' | 'expected_pattern' | 'expected_action' | 'expected_severity'
  >;
  actual: V3EvalCaseActual;
};

export type V3ModuleScore = {
  skill_module: string;
  case_count: number;
  passed_cases: number;
  weighted_score: number;
  decision_accuracy: number;
  pattern_hit_rate: number;
  severity_accuracy: number;
  action_accuracy: number;
  rewrite_score: number;
};

export type V3EvalMetrics = {
  total_cases: number;
  passed_cases: number;
  weighted_quality_score: number;
  decision_accuracy: number;
  pattern_hit_rate: number;
  severity_accuracy: number;
  action_accuracy: number;
  rewrite_score: number;
  false_reject_rate: number;
  blocker_miss_rate: number;
  module_scores: V3ModuleScore[];
};

function scoreBinary(match: boolean): number {
  return match ? 1 : 0;
}

export function scoreV3Case(
  benchmarkCase: BenchmarkV3Case,
  actual: V3EvalCaseActual,
  rewriteScore: number,
): V3EvalCaseResult {
  const decisionScore = scoreBinary(actual.final_decision === benchmarkCase.expected_decision);
  const patternScore =
    benchmarkCase.expected_pattern === null
      ? 1
      : scoreBinary(actual.pattern_ids.includes(benchmarkCase.expected_pattern));
  const severityScore =
    actual.severities.length === 0
      ? scoreBinary(benchmarkCase.expected_severity === 'MEDIUM')
      : scoreBinary(
          actual.severities.some(
            (s) => s.toUpperCase() === benchmarkCase.expected_severity.toUpperCase(),
          ),
        );
  const actionScore = scoreBinary(actual.action === benchmarkCase.expected_action);
  const rewriteDimScore =
    benchmarkCase.expected_action === 'REWRITE' ? rewriteScore : 1;

  const dimension_scores: V3DimensionScores = {
    decision: decisionScore,
    pattern_hit: patternScore,
    severity: severityScore,
    action: actionScore,
    rewrite: rewriteDimScore,
  };

  const weights = {
    decision: 0.35,
    pattern_hit: 0.2,
    severity: 0.1,
    action: 0.15,
    rewrite: 0.2,
  };

  const weighted_score =
    dimension_scores.decision * weights.decision +
    dimension_scores.pattern_hit * weights.pattern_hit +
    dimension_scores.severity * weights.severity +
    dimension_scores.action * weights.action +
    dimension_scores.rewrite * weights.rewrite;

  const failures: string[] = [];
  if (!decisionScore) {
    failures.push(`decision: expected ${benchmarkCase.expected_decision}, got ${actual.final_decision}`);
  }
  if (!patternScore && benchmarkCase.expected_pattern) {
    failures.push(`pattern: expected ${benchmarkCase.expected_pattern}, got ${actual.pattern_ids.join(',')}`);
  }
  if (!actionScore) {
    failures.push(`action: expected ${benchmarkCase.expected_action}, got ${actual.action}`);
  }
  if (rewriteDimScore < 1) {
    failures.push('rewrite: structured expectations not met');
  }

  return {
    case_id: benchmarkCase.case_id,
    expected_skill: benchmarkCase.expected_skill,
    tier: benchmarkCase.tier,
    weight: benchmarkCase.evaluation_weight,
    passed: failures.length === 0,
    dimension_scores,
    weighted_score,
    failures,
    expected: {
      expected_decision: benchmarkCase.expected_decision,
      expected_pattern: benchmarkCase.expected_pattern,
      expected_action: benchmarkCase.expected_action,
      expected_severity: benchmarkCase.expected_severity,
    },
    actual,
  };
}

export function aggregateV3Metrics(results: V3EvalCaseResult[]): V3EvalMetrics {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;

  const sum = (fn: (r: V3EvalCaseResult) => number) =>
    results.reduce((acc, r) => acc + fn(r) * r.weight, 0);
  const weightSum = results.reduce((acc, r) => acc + r.weight, 0) || 1;

  const weighted_quality_score = sum((r) => r.weighted_score) / weightSum;

  const moduleMap = new Map<string, V3EvalCaseResult[]>();
  for (const result of results) {
    const list = moduleMap.get(result.expected_skill) ?? [];
    list.push(result);
    moduleMap.set(result.expected_skill, list);
  }

  const module_scores: V3ModuleScore[] = [...moduleMap.entries()].map(([skill_module, modResults]) => {
    const w = modResults.reduce((a, r) => a + r.weight, 0) || 1;
    const avg = (fn: (r: V3EvalCaseResult) => number) =>
      modResults.reduce((a, r) => a + fn(r) * r.weight, 0) / w;
    return {
      skill_module,
      case_count: modResults.length,
      passed_cases: modResults.filter((r) => r.passed).length,
      weighted_score: avg((r) => r.weighted_score),
      decision_accuracy: avg((r) => r.dimension_scores.decision),
      pattern_hit_rate: avg((r) => r.dimension_scores.pattern_hit),
      severity_accuracy: avg((r) => r.dimension_scores.severity),
      action_accuracy: avg((r) => r.dimension_scores.action),
      rewrite_score: avg((r) => r.dimension_scores.rewrite),
    };
  });

  const nonReject = results.filter((r) => r.expected.expected_decision !== 'REJECT');
  const falseRejects = nonReject.filter((r) => r.actual.final_decision === 'REJECT').length;
  const blockerCases = results.filter((r) => r.expected.expected_decision === 'REJECT');
  const blockerMisses = blockerCases.filter((r) => r.actual.final_decision !== 'REJECT').length;

  return {
    total_cases: total,
    passed_cases: passed,
    weighted_quality_score,
    decision_accuracy: sum((r) => r.dimension_scores.decision) / weightSum,
    pattern_hit_rate: sum((r) => r.dimension_scores.pattern_hit) / weightSum,
    severity_accuracy: sum((r) => r.dimension_scores.severity) / weightSum,
    action_accuracy: sum((r) => r.dimension_scores.action) / weightSum,
    rewrite_score: sum((r) => r.dimension_scores.rewrite) / weightSum,
    false_reject_rate: nonReject.length === 0 ? 0 : falseRejects / nonReject.length,
    blocker_miss_rate: blockerCases.length === 0 ? 0 : blockerMisses / blockerCases.length,
    module_scores,
  };
}
