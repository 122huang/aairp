import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { caseCorpusPlugin, caseKqsDimensions } from './corpus/case-corpus.plugin.js';
import {
  writeCorpusCoverageReport,
  writeCorpusDashboard,
} from './platform/knowledge-platform.js';
import { scoreCorpusKqs } from './platform/governance/kqs.js';
import { formatCorpusCoverageMarkdown } from './platform/governance/coverage.js';
import type { CorpusCoverageReport } from './platform/governance/coverage.js';
import { validateCaseCorpus, type CaseValidationResult } from './case-corpus-validator.js';
import { buildCaseCorpusManifest, type CaseCorpusManifest } from './case-corpus-index.js';
import { loadCaseCorpusEntries } from './case-corpus.js';
import { readFileSync } from 'node:fs';
import { dirname, join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';

export type CaseCorpusDashboard = {
  generated_at: string;
  manifest: CaseCorpusManifest;
  coverage: CorpusCoverageReport;
  validation: CaseValidationResult;
  gap_report: CaseGapReport;
};

export type CaseGapReport = {
  asset_quality_kqs: number;
  benchmark_coverage_pct: number;
  benchmark_covered: number;
  benchmark_total: number;
  verified_cases: number;
  regression_cases: number;
  skill_eval_coverage_pct: number;
};

function repoRoot(): string {
  return joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

export function buildCaseGapReport(entries = loadCaseCorpusEntries()): CaseGapReport {
  const benchmarkPath = joinPath(repoRoot(), 'benchmark/benchmark-v3.json');
  const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as { cases: Array<{ case_id: string }> };
  const benchmarkTotal = benchmark.cases.length;
  const benchmarkCovered = new Set(entries.map((entry) => entry.benchmark_ref)).size;
  const kqs = scoreCorpusKqs(entries, caseKqsDimensions, (entry) => entry.case_id);
  const skillIds = new Set<string>();
  for (const entry of entries) {
    for (const skillId of entry.linkage.skills ?? []) {
      skillIds.add(skillId);
    }
  }
  const verified = entries.filter((entry) => entry.case_status === 'verified').length;
  const regression = entries.filter((entry) => entry.case_status === 'regression').length;

  return {
    asset_quality_kqs: kqs.overall,
    benchmark_coverage_pct: benchmarkTotal > 0 ? Math.round((benchmarkCovered / benchmarkTotal) * 1000) / 10 : 0,
    benchmark_covered: benchmarkCovered,
    benchmark_total: benchmarkTotal,
    verified_cases: verified,
    regression_cases: regression,
    skill_eval_coverage_pct: Math.round((skillIds.size / 5) * 1000) / 10,
  };
}

export function buildCaseCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
}): CaseCorpusDashboard {
  const now = options?.now ?? new Date();
  const bundle = caseCorpusPlugin.load(options?.customRoot);
  const coverage = caseCorpusPlugin.buildCoverage(bundle.entries, now);
  return {
    generated_at: now.toISOString(),
    manifest: buildCaseCorpusManifest({ ...options, now }),
    coverage,
    validation: validateCaseCorpus({ ...options, now }),
    gap_report: buildCaseGapReport(bundle.entries),
  };
}

export function formatCaseDashboardMarkdown(dashboard: CaseCorpusDashboard): string {
  const coverageMd = formatCorpusCoverageMarkdown(dashboard.coverage, 'Case Corpus Coverage Report');
  const gap = dashboard.gap_report;
  return [
    coverageMd,
    '',
    '## Case Corpus Gap Report',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Asset quality (KQS) | ${gap.asset_quality_kqs}% |`,
    `| Benchmark coverage | ${gap.benchmark_covered}/${gap.benchmark_total} (${gap.benchmark_coverage_pct}%) |`,
    `| Verified cases | ${gap.verified_cases} |`,
    `| Regression cases | ${gap.regression_cases} |`,
    `| Skill eval coverage (of 5) | ${gap.skill_eval_coverage_pct}% |`,
    '',
    '## Validation Summary',
    '',
    `| Passed | ${dashboard.validation.passed ? 'yes' : 'no'} |`,
    `| Errors | ${dashboard.validation.error_count} |`,
    `| Warnings | ${dashboard.validation.warn_count} |`,
  ].join('\n');
}

export function writeCaseCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
  outputDir?: string;
}): CaseCorpusDashboard {
  const dashboard = buildCaseCorpusDashboard(options);
  const reportsDir = options?.outputDir ?? caseCorpusPlugin.defaultReportsDir();
  writeCorpusDashboard(caseCorpusPlugin, options);
  const timestamp = dashboard.generated_at.replace(/[:.]/g, '-');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `case-corpus-dashboard-${timestamp}.md`),
    `${formatCaseDashboardMarkdown(dashboard)}\n`,
  );
  return dashboard;
}

export function writeCaseCoverageReport(options?: {
  customRoot?: string;
  now?: Date;
}): CorpusCoverageReport {
  return writeCorpusCoverageReport(caseCorpusPlugin, options);
}
