import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkillModules } from '../knowledge/skill-modules.js';
import { loadKnowledgePackManifest } from '../knowledge/knowledge-pack-manifest.js';
import {
  compareToBaseline,
  loadBenchmarkV3Baseline,
  type RegressionComparison,
} from './benchmark-v3-baseline.js';
import {
  runBenchmarkV3Eval,
  type BenchmarkV3EvalResult,
} from './benchmark-v3-evaluator.service.js';
import type { V3ModuleScore } from './eval-v3-metrics.js';

export type ModuleEvalDashboard = {
  generated_at: string;
  baseline_id: string;
  knowledge_pack_version: string | null;
  knowledge_pack_fingerprint: string | null;
  tier: string;
  eval_result: BenchmarkV3EvalResult;
  regression_comparison: RegressionComparison;
  modules: ModuleDashboardRow[];
};

export type ModuleDashboardRow = V3ModuleScore & {
  owner: string | null;
  owner_type: string | null;
  freshness_status: string | null;
  benchmark_confidence: 'high' | 'medium' | 'low';
  regression_status: 'pass' | 'partial' | 'fail';
};

export type BuildModuleDashboardOptions = {
  tier?: 'regression' | 'extended';
  runEval?: boolean;
  evalResult?: BenchmarkV3EvalResult;
  writeReports?: boolean;
  outputDir?: string;
};

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function defaultReportsDir(): string {
  return join(repoRoot(), 'reports');
}

function moduleConfidence(
  mod: V3ModuleScore,
  legalVerifiedPct: number,
): 'high' | 'medium' | 'low' {
  if (mod.case_count >= 3 && mod.decision_accuracy >= 1 && legalVerifiedPct >= 90) {
    return 'high';
  }
  if (mod.case_count >= 1 && mod.decision_accuracy >= 0.9) {
    return 'medium';
  }
  return 'low';
}

function moduleRegressionStatus(mod: V3ModuleScore): 'pass' | 'partial' | 'fail' {
  if (mod.passed_cases === mod.case_count && mod.decision_accuracy >= 1) {
    return 'pass';
  }
  if (mod.decision_accuracy >= 0.9) {
    return 'partial';
  }
  return 'fail';
}

export function buildModuleEvalDashboard(
  evalResult: BenchmarkV3EvalResult,
  comparison: RegressionComparison,
  tier: string,
): ModuleEvalDashboard {
  const skillModules = loadSkillModules();
  const baseline = loadBenchmarkV3Baseline();
  const moduleByName = new Map(skillModules.modules.map((m) => [m.skill_module, m]));

  const modules: ModuleDashboardRow[] = evalResult.metrics.module_scores.map((mod) => {
    const contract = moduleByName.get(mod.skill_module);
    return {
      ...mod,
      owner: contract?.owner ?? null,
      owner_type: contract?.owner_type ?? null,
      freshness_status: contract?.freshness_status ?? null,
      benchmark_confidence: moduleConfidence(mod, baseline.regression_tier.legal_verified_pct),
      regression_status: moduleRegressionStatus(mod),
    };
  });

  return {
    generated_at: evalResult.evaluated_at,
    baseline_id: comparison.baseline_id,
    knowledge_pack_version: evalResult.knowledge_pack_version,
    knowledge_pack_fingerprint: evalResult.knowledge_pack_fingerprint,
    tier,
    eval_result: evalResult,
    regression_comparison: comparison,
    modules,
  };
}

export function formatModuleDashboardMarkdown(dashboard: ModuleEvalDashboard): string {
  const cmp = dashboard.regression_comparison;
  const m = dashboard.eval_result.metrics;
  const lines = [
    '# Skill Module Evaluation Dashboard',
    '',
    `**Baseline:** ${dashboard.baseline_id}`,
    `**Tier:** ${dashboard.tier}`,
    `**Knowledge Pack:** ${dashboard.knowledge_pack_version ?? '(not generated)'}`,
    `**Evaluated at:** ${dashboard.generated_at}`,
    '',
    '## Regression Summary',
    '',
    '| Metric | Current | Baseline | Delta |',
    '|--------|--------:|---------:|------:|',
    `| Weighted quality | ${(m.weighted_quality_score * 100).toFixed(1)}% | ${loadBenchmarkV3Baseline().metrics.weighted_quality_pct}% | ${(cmp.delta_weighted_quality * 100).toFixed(1)} pp |`,
    `| Decision accuracy | ${(m.decision_accuracy * 100).toFixed(1)}% | ${loadBenchmarkV3Baseline().metrics.decision_accuracy_pct}% | ${(cmp.delta_decision_accuracy * 100).toFixed(1)} pp |`,
    `| Passed cases | ${m.passed_cases}/${m.total_cases} | ${loadBenchmarkV3Baseline().metrics.passed_cases}/${loadBenchmarkV3Baseline().metrics.total_cases} | — |`,
    `| Status | **${cmp.regression_status.toUpperCase()}** | — | — |`,
    '',
    '## Per-Module Quality',
    '',
    '| Module | Cases | Passed | Quality | Decision | Pattern | Owner | Confidence | Status |',
    '|--------|------:|-------:|--------:|---------:|--------:|-------|------------|--------|',
  ];

  for (const mod of dashboard.modules) {
    lines.push(
      `| ${mod.skill_module} | ${mod.case_count} | ${mod.passed_cases} | ${(mod.weighted_score * 100).toFixed(1)}% | ${(mod.decision_accuracy * 100).toFixed(0)}% | ${(mod.pattern_hit_rate * 100).toFixed(0)}% | ${mod.owner ?? '—'} | ${mod.benchmark_confidence} | ${mod.regression_status} |`,
    );
  }

  if (cmp.cases_regressed.length > 0) {
    lines.push('', '## Regressed Cases', '', cmp.cases_regressed.map((id) => `- ${id}`).join('\n'));
  }
  if (dashboard.eval_result.failed_case_ids.length > 0) {
    lines.push(
      '',
      '## Failed Cases',
      '',
      dashboard.eval_result.failed_case_ids.map((id) => `- ${id}`).join('\n'),
    );
  }

  return lines.join('\n');
}

export async function runModuleEvalDashboard(
  options: BuildModuleDashboardOptions = {},
): Promise<ModuleEvalDashboard> {
  const tier = options.tier ?? 'regression';
  const evalResult =
    options.evalResult ??
    (await runBenchmarkV3Eval({
      tier,
      writeReports: options.runEval !== false && options.evalResult === undefined,
    }));

  const baseline = loadBenchmarkV3Baseline();
  const comparison = compareToBaseline(baseline, evalResult);
  const dashboard = buildModuleEvalDashboard(evalResult, comparison, tier);

  if (options.writeReports !== false) {
    const outputDir = options.outputDir ?? defaultReportsDir();
    mkdirSync(outputDir, { recursive: true });
    const stamp = dashboard.generated_at.replace(/[:.]/g, '-');
    writeFileSync(
      join(outputDir, `module-eval-dashboard-${stamp}.json`),
      `${JSON.stringify(dashboard, null, 2)}\n`,
    );
    writeFileSync(
      join(outputDir, `module-eval-dashboard-${stamp}.md`),
      `${formatModuleDashboardMarkdown(dashboard)}\n`,
    );
  }

  return dashboard;
}

export function buildKnowledgeGateT2Report(dashboard: ModuleEvalDashboard) {
  const pack = loadKnowledgePackManifest();
  return {
    gate_tier: 'T2',
    mode: 'report-only',
    passed: dashboard.eval_result.failed_case_ids.length === 0,
    generated_at: dashboard.generated_at,
    knowledge_pack_version: pack?.knowledge_pack_version ?? dashboard.knowledge_pack_version,
    knowledge_pack_fingerprint:
      pack?.knowledge_pack_fingerprint ?? dashboard.knowledge_pack_fingerprint,
    baseline_id: dashboard.baseline_id,
    regression_status: dashboard.regression_comparison.regression_status,
    metrics: {
      weighted_quality_score: dashboard.eval_result.metrics.weighted_quality_score,
      decision_accuracy: dashboard.eval_result.metrics.decision_accuracy,
      blocker_miss_rate: dashboard.eval_result.metrics.blocker_miss_rate,
      false_reject_rate: dashboard.eval_result.metrics.false_reject_rate,
    },
    module_scores: dashboard.modules.map((m) => ({
      skill_module: m.skill_module,
      weighted_score: m.weighted_score,
      decision_accuracy: m.decision_accuracy,
      regression_status: m.regression_status,
      benchmark_confidence: m.benchmark_confidence,
    })),
    merge_block: false,
    note: 'T2 is informational only. T3 merge-block deferred per baseline gate_policy.',
  };
}

export function writeKnowledgeGateT2Report(dashboard: ModuleEvalDashboard): string {
  const report = buildKnowledgeGateT2Report(dashboard);
  const outputDir = defaultReportsDir();
  mkdirSync(outputDir, { recursive: true });
  const version = report.knowledge_pack_version ?? 'unknown';
  const path = join(outputDir, `knowledge-gate-T2-${version}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
}
