import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkV3EvalResult } from './benchmark-v3-evaluator.service.js';
import type { V3EvalMetrics, V3ModuleScore } from './eval-v3-metrics.js';

export type BenchmarkV3Baseline = {
  schema_version: string;
  baseline_id: string;
  frozen_at: string;
  approved_in: string;
  description: string;
  benchmark_v3: {
    benchmark_id: string;
    schema_version: string;
    modules_version: string;
    content_fingerprint: string;
    source_path: string;
  };
  regression_tier: {
    tier: string;
    case_count: number;
    case_ids: string[];
    legal_verified_count: number;
    legal_verified_pct: number;
  };
  metrics: {
    weighted_quality_score: number;
    weighted_quality_pct: number;
    decision_accuracy: number;
    decision_accuracy_pct: number;
    pattern_hit_rate: number;
    severity_accuracy: number;
    action_accuracy: number;
    rewrite_score: number;
    false_reject_rate: number;
    blocker_miss_rate: number;
    passed_cases: number;
    total_cases: number;
  };
  module_scores: V3ModuleScore[];
  eval_snapshot_path: string;
  known_limitations: string[];
  gate_policy: {
    t2_report_only: boolean;
    t3_merge_block: boolean;
    t3_prerequisites: string[];
  };
};

export type RegressionComparison = {
  baseline_id: string;
  current_evaluated_at: string;
  delta_weighted_quality: number;
  delta_decision_accuracy: number;
  regression_status: 'stable' | 'improved' | 'degraded';
  cases_regressed: string[];
  cases_improved: string[];
  module_deltas: Array<{
    skill_module: string;
    baseline_score: number;
    current_score: number;
    delta: number;
  }>;
};

const defaultBaselinePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../benchmark/benchmark-v3-baseline.json',
);

export function resolveBaselinePath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.AAIRP_BENCHMARK_V3_BASELINE_PATH) {
    return process.env.AAIRP_BENCHMARK_V3_BASELINE_PATH;
  }
  return defaultBaselinePath;
}

export function loadBenchmarkV3Baseline(customPath?: string): BenchmarkV3Baseline {
  const path = resolveBaselinePath(customPath);
  if (!existsSync(path)) {
    throw new Error(`benchmark v3 baseline not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as BenchmarkV3Baseline;
}

export function compareToBaseline(
  baseline: BenchmarkV3Baseline,
  current: BenchmarkV3EvalResult,
): RegressionComparison {
  const delta_weighted_quality =
    current.metrics.weighted_quality_score - baseline.metrics.weighted_quality_score;
  const delta_decision_accuracy =
    current.metrics.decision_accuracy - baseline.metrics.decision_accuracy;

  const baselineCaseMap = new Map(
    loadBaselineEvalSnapshot(baseline).case_results.map((c) => [c.case_id, c]),
  );

  const cases_regressed: string[] = [];
  const cases_improved: string[] = [];
  for (const result of current.case_results) {
    const prev = baselineCaseMap.get(result.case_id);
    if (!prev) {
      continue;
    }
    if (!result.passed && prev.passed) {
      cases_regressed.push(result.case_id);
    }
    if (result.passed && !prev.passed) {
      cases_improved.push(result.case_id);
    }
  }

  let regression_status: RegressionComparison['regression_status'] = 'stable';
  if (cases_regressed.length > 0) {
    regression_status = 'degraded';
  } else if (delta_weighted_quality > 0.001 || cases_improved.length > 0) {
    regression_status = 'improved';
  } else if (delta_weighted_quality < -0.001) {
    regression_status = 'degraded';
  }

  const currentModuleMap = new Map(
    current.metrics.module_scores.map((m) => [m.skill_module, m.weighted_score]),
  );
  const module_deltas = baseline.module_scores.map((mod) => {
    const currentScore = currentModuleMap.get(mod.skill_module) ?? 0;
    return {
      skill_module: mod.skill_module,
      baseline_score: mod.weighted_score,
      current_score: currentScore,
      delta: currentScore - mod.weighted_score,
    };
  });

  return {
    baseline_id: baseline.baseline_id,
    current_evaluated_at: current.evaluated_at,
    delta_weighted_quality,
    delta_decision_accuracy,
    regression_status,
    cases_regressed,
    cases_improved,
    module_deltas,
  };
}

export function loadBaselineEvalSnapshot(
  baseline: BenchmarkV3Baseline,
): Pick<BenchmarkV3EvalResult, 'case_results' | 'metrics'> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
  const snapshotPath = join(root, baseline.eval_snapshot_path);
  if (!existsSync(snapshotPath)) {
    return { case_results: [], metrics: baseline.metrics as unknown as V3EvalMetrics };
  }
  const raw = JSON.parse(readFileSync(snapshotPath, 'utf8')) as BenchmarkV3EvalResult;
  return { case_results: raw.case_results, metrics: raw.metrics as V3EvalMetrics };
}
