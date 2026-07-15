import type { ReviewContext } from '@aairp/shared-kernel';

export type BenchmarkFindingRef = {
  module: 'RULE' | 'PLAYBOOK' | 'LLM';
  ref_id: string;
};

export type BenchmarkGroundTruth = {
  expected_decision: 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';
  expected_findings?: BenchmarkFindingRef[];
  must_not_include_refs?: string[];
  open_risk_skipped?: boolean;
};

export type BenchmarkCase = {
  case_id: string;
  description: string;
  tags: string[];
  context: ReviewContext;
  ground_truth: BenchmarkGroundTruth;
};

export type BenchmarkManifest = {
  schema_version: string;
  benchmark_id: string;
  description?: string;
  regression_subset?: string[];
  cases: BenchmarkCase[];
};

export type EvalCaseActual = {
  final_decision: 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';
  finding_refs: BenchmarkFindingRef[];
  open_risk_skipped: boolean;
  rationale: string;
};

export type EvalCaseResult = {
  case_id: string;
  description: string;
  tags: string[];
  passed: boolean;
  expected: BenchmarkGroundTruth;
  actual: EvalCaseActual;
  failures: string[];
};

export type EvalMetrics = {
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  decision_accuracy: number;
  blocker_recall: number;
  false_reject_rate: number;
  finding_precision: number;
  finding_recall: number;
  finding_f1: number;
};

export type BenchmarkEvalResult = {
  benchmark_id: string;
  schema_version: string;
  evaluated_at: string;
  manifest_path: string;
  case_results: EvalCaseResult[];
  metrics: EvalMetrics;
  failed_case_ids: string[];
};
