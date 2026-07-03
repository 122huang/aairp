import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evidenceCorpusPlugin } from './corpus/evidence-corpus.plugin.js';
import {
  buildCorpusDashboard,
  writeCorpusCoverageReport,
  writeCorpusDashboard,
} from './platform/knowledge-platform.js';
import type { CorpusDashboard } from './platform/governance/dashboard.js';
import {
  buildEvidenceCoverageReport,
  formatEvidenceCoverageMarkdown,
  type EvidenceCoverageReport,
} from './evidence-corpus-coverage.js';
import { validateEvidenceCorpus, type EvidenceValidationResult } from './evidence-corpus-validator.js';
import { buildEvidenceCorpusManifest, type EvidenceCorpusManifest } from './evidence-corpus-index.js';

export type EvidenceCorpusDashboard = {
  generated_at: string;
  manifest: EvidenceCorpusManifest;
  coverage: EvidenceCoverageReport;
  validation: EvidenceValidationResult;
  entries_by_freshness: CorpusDashboard['entries_by_freshness'];
  ownership_by_type: Record<string, number>;
};

export function buildEvidenceCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
}): EvidenceCorpusDashboard {
  const now = options?.now ?? new Date();
  const dashboard = buildCorpusDashboard(evidenceCorpusPlugin, { ...options, now });
  return {
    generated_at: dashboard.generated_at,
    manifest: buildEvidenceCorpusManifest({ ...options, now }),
    coverage: buildEvidenceCoverageReport({ ...options, now }),
    validation: validateEvidenceCorpus({ ...options, now }),
    entries_by_freshness: dashboard.entries_by_freshness,
    ownership_by_type: dashboard.ownership_by_type,
  };
}

export function formatEvidenceDashboardMarkdown(dashboard: EvidenceCorpusDashboard): string {
  const coverageMd = formatEvidenceCoverageMarkdown(dashboard.coverage);
  const lines = [
    coverageMd,
    '',
    '## Evidence Corpus Dashboard',
    '',
    '### Corpus Index',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Fingerprint | \`${dashboard.manifest.fingerprint}\` |`,
    `| Platform version | ${dashboard.manifest.platform_version} |`,
    `| Manifest path | evidence-corpus.manifest.json |`,
    '',
    '### Evidence Status',
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
      lines.push(`- \`${issue.evidence_id}\` [${issue.code}]: ${issue.message}`);
    }
  }

  return lines.join('\n');
}

export function writeEvidenceCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
  outputDir?: string;
}): EvidenceCorpusDashboard {
  const dashboard = buildEvidenceCorpusDashboard(options);
  const reportsDir = options?.outputDir ?? evidenceCorpusPlugin.defaultReportsDir();
  writeCorpusDashboard(evidenceCorpusPlugin, options);
  const timestamp = dashboard.generated_at.replace(/[:.]/g, '-');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `evidence-corpus-dashboard-${timestamp}.md`),
    `${formatEvidenceDashboardMarkdown(dashboard)}\n`,
  );
  return dashboard;
}

export function writeEvidenceCoverageReport(options?: {
  customRoot?: string;
  now?: Date;
  outputDir?: string;
}): EvidenceCoverageReport {
  writeCorpusCoverageReport(evidenceCorpusPlugin, options);
  return buildEvidenceCoverageReport(options);
}
