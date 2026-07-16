import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkEvalResult, EvalCaseResult } from './benchmark-types.js';
import { formatFindingRefs } from './eval-case.js';
import { formatMetricPercent } from './eval-metrics.js';

function renderFailureSection(failures: EvalCaseResult[]): string {
  if (failures.length === 0) {
    return 'All cases passed.\n';
  }

  const blocks = failures.map((result) => {
    const lines = [
      `### ${result.case_id}`,
      '',
      result.description,
      '',
      `- **Expected decision:** ${result.expected.expected_decision}`,
      `- **Actual decision:** ${result.actual.final_decision}`,
      `- **Expected findings:** ${formatFindingRefs(result.expected.expected_findings ?? [])}`,
      `- **Actual findings:** ${formatFindingRefs(result.actual.finding_refs)}`,
      `- **Rationale:** ${result.actual.rationale}`,
      '',
      '**Failures:**',
      ...result.failures.map((failure) => `- ${failure}`),
      '',
    ];
    return lines.join('\n');
  });

  return blocks.join('\n');
}

export function renderAccuracyReportMarkdown(result: BenchmarkEvalResult): string {
  const { metrics } = result;
  const failures = result.case_results.filter((caseResult) => !caseResult.passed);

  return `# AAIRP Benchmark Evaluation Report

| Field | Value |
|-------|-------|
| Benchmark | ${result.benchmark_id} |
| Schema | ${result.schema_version} |
| Evaluated at | ${result.evaluated_at} |
| Manifest | ${result.manifest_path} |

## Summary Metrics

| Metric | Value |
|--------|-------|
| Total cases | ${metrics.total_cases} |
| Passed | ${metrics.passed_cases} |
| Failed | ${metrics.failed_cases} |
| Decision Accuracy | ${formatMetricPercent(metrics.decision_accuracy)} |
| BLOCKER Recall | ${formatMetricPercent(metrics.blocker_recall)} |
| False REJECT Rate | ${formatMetricPercent(metrics.false_reject_rate)} |
| Finding Precision | ${formatMetricPercent(metrics.finding_precision)} |
| Finding Recall | ${formatMetricPercent(metrics.finding_recall)} |
| Finding F1 | ${formatMetricPercent(metrics.finding_f1)} |

## Market Review Status

Decision Accuracy above spans every market, including ones with no Legal-written market
card yet. Split by review status:

| Tier | Countries | Passed | Total | Decision Accuracy |
|------|-----------|--------|-------|--------------------|
| Legal-reviewed markets | ${metrics.legal_reviewed_markets.country_ids.join(', ')} | ${metrics.legal_reviewed_markets.passed_cases} | ${metrics.legal_reviewed_markets.total_cases} | ${formatMetricPercent(metrics.legal_reviewed_markets.decision_accuracy)} |
| ⚠ No market card yet (demo rules only) | ${metrics.unreviewed_markets.country_ids.join(', ') || '—'} | ${metrics.unreviewed_markets.passed_cases} | ${metrics.unreviewed_markets.total_cases} | ${formatMetricPercent(metrics.unreviewed_markets.decision_accuracy)} |

## Case Results

| Case ID | Expected | Actual | Pass |
|---------|----------|--------|------|
${result.case_results
  .map(
    (caseResult) =>
      `| ${caseResult.case_id} | ${caseResult.expected.expected_decision} | ${caseResult.actual.final_decision} | ${caseResult.passed ? 'PASS' : 'FAIL'} |`,
  )
  .join('\n')}

## Explainability — Failed Cases

${renderFailureSection(failures)}
`;
}

export function renderAccuracyReportHtml(result: BenchmarkEvalResult): string {
  const markdown = renderAccuracyReportMarkdown(result);
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Benchmark Eval ${result.benchmark_id}</title>
  <style>
    body { font-family: monospace; white-space: pre-wrap; padding: 24px; }
  </style>
</head>
<body>${escaped}</body>
</html>`;
}

export function defaultReportsOutputDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../reports');
}

export function writeEvalReports(
  result: BenchmarkEvalResult,
  outputDir: string,
): { jsonPath: string; markdownPath: string; htmlPath: string } {
  mkdirSync(outputDir, { recursive: true });

  const stamp = result.evaluated_at.replace(/[:.]/g, '-');
  const baseName = `eval-${stamp}`;
  const jsonPath = join(outputDir, `${baseName}.json`);
  const markdownPath = join(outputDir, `${baseName}.md`);
  const htmlPath = join(outputDir, `${baseName}.html`);

  writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
  writeFileSync(markdownPath, renderAccuracyReportMarkdown(result), 'utf8');
  writeFileSync(htmlPath, renderAccuracyReportHtml(result), 'utf8');

  return { jsonPath, markdownPath, htmlPath };
}
