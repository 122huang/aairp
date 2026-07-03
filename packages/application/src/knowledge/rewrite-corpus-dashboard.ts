import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rewriteCorpusPlugin } from './corpus/rewrite-corpus.plugin.js';
import {
  buildCorpusDashboard,
  writeCorpusCoverageReport,
  writeCorpusDashboard,
} from './platform/knowledge-platform.js';
import type { CorpusDashboard } from './platform/governance/dashboard.js';
import {
  buildRewriteCoverageReport,
  formatRewriteCoverageMarkdown,
} from './rewrite-corpus-coverage.js';
import { validateRewriteCorpus } from './rewrite-corpus-validator.js';
import { buildRewriteCorpusManifest } from './rewrite-corpus-index.js';
import type { RewriteCoverageReport } from './rewrite-corpus-coverage.js';
import type { RewriteValidationResult } from './rewrite-corpus-validator.js';
import type { RewriteCorpusManifest } from './rewrite-corpus-index.js';

export type RewriteCorpusDashboard = {
  generated_at: string;
  manifest: RewriteCorpusManifest;
  coverage: RewriteCoverageReport;
  validation: RewriteValidationResult;
  entries_by_freshness: CorpusDashboard['entries_by_freshness'];
  ownership_by_type: Record<string, number>;
};

export function buildRewriteCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
}): RewriteCorpusDashboard {
  const now = options?.now ?? new Date();
  const dashboard = buildCorpusDashboard(rewriteCorpusPlugin, { ...options, now });
  return {
    generated_at: dashboard.generated_at,
    manifest: buildRewriteCorpusManifest({ ...options, now }),
    coverage: buildRewriteCoverageReport({ ...options, now }),
    validation: validateRewriteCorpus({ ...options, now }),
    entries_by_freshness: dashboard.entries_by_freshness,
    ownership_by_type: dashboard.ownership_by_type,
  };
}

export function formatRewriteDashboardMarkdown(dashboard: RewriteCorpusDashboard): string {
  const coverageMd = formatRewriteCoverageMarkdown(dashboard.coverage);
  const lines = [
    coverageMd,
    '',
    '## Rewrite Corpus Dashboard',
    '',
    '### Corpus Index',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Fingerprint | \`${dashboard.manifest.fingerprint}\` |`,
    `| Platform version | ${dashboard.manifest.platform_version} |`,
    `| Manifest path | rewrite-corpus.manifest.json |`,
    '',
    '### Rewrite Status',
    '',
    '| Status | Count |',
    '|--------|------:|',
  ];

  for (const [status, count] of Object.entries(dashboard.manifest.by_status).sort()) {
    lines.push(`| ${status} | ${count} |`);
  }

  lines.push(
    '',
    '### Validation Summary',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Passed (no errors) | ${dashboard.validation.passed ? 'yes' : 'no'} |`,
    `| Errors | ${dashboard.validation.error_count} |`,
    `| Governance warnings | ${dashboard.validation.warn_count} |`,
  );

  if (dashboard.validation.governance_warnings.length > 0) {
    lines.push('', '### Governance Warnings (sample)', '');
    for (const issue of dashboard.validation.governance_warnings.slice(0, 15)) {
      lines.push(`- \`${issue.rewrite_id}\` [${issue.code}]: ${issue.message}`);
    }
  }

  return lines.join('\n');
}

export function writeRewriteCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
  outputDir?: string;
}): RewriteCorpusDashboard {
  const dashboard = buildRewriteCorpusDashboard(options);
  const reportsDir = options?.outputDir ?? rewriteCorpusPlugin.defaultReportsDir();
  writeCorpusDashboard(rewriteCorpusPlugin, options);
  const timestamp = dashboard.generated_at.replace(/[:.]/g, '-');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `rewrite-corpus-dashboard-${timestamp}.md`),
    `${formatRewriteDashboardMarkdown(dashboard)}\n`,
  );
  return dashboard;
}

export function writeRewriteCoverageReport(options?: {
  customRoot?: string;
  now?: Date;
  outputDir?: string;
}): RewriteCoverageReport {
  writeCorpusCoverageReport(rewriteCorpusPlugin, options);
  return buildRewriteCoverageReport(options);
}
