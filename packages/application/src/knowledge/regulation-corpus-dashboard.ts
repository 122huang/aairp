import { regulationCorpusPlugin } from './corpus/regulation-corpus.plugin.js';
import {
  buildCorpusDashboard,
  writeCorpusCoverageReport,
  writeCorpusDashboard,
} from './platform/knowledge-platform.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CorpusDashboard } from './platform/governance/dashboard.js';
import { buildRegulationCoverageReport, formatRegulationCoverageMarkdown } from './regulation-corpus-coverage.js';
import { validateRegulationCorpus } from './regulation-corpus-validator.js';
import { buildRegulationCorpusManifest } from './regulation-corpus-index.js';
import type { RegulationCoverageReport } from './regulation-corpus-coverage.js';
import type { RegulationValidationResult } from './regulation-corpus-validator.js';
import type { RegulationCorpusManifest } from './regulation-corpus-index.js';

export type RegulationCorpusDashboard = {
  generated_at: string;
  manifest: RegulationCorpusManifest;
  coverage: RegulationCoverageReport;
  validation: RegulationValidationResult;
  entries_by_freshness: CorpusDashboard['entries_by_freshness'];
  ownership_by_type: Record<string, number>;
};

function mapDashboard(dashboard: CorpusDashboard): RegulationCorpusDashboard {
  return {
    generated_at: dashboard.generated_at,
    manifest: dashboard.manifest as RegulationCorpusManifest,
    coverage: buildRegulationCoverageReport({ now: new Date(dashboard.generated_at) }),
    validation: validateRegulationCorpus({ now: new Date(dashboard.generated_at) }),
    entries_by_freshness: dashboard.entries_by_freshness,
    ownership_by_type: dashboard.ownership_by_type,
  };
}

export function buildRegulationCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
}): RegulationCorpusDashboard {
  const now = options?.now ?? new Date();
  const dashboard = buildCorpusDashboard(regulationCorpusPlugin, { ...options, now });
  return {
    generated_at: dashboard.generated_at,
    manifest: buildRegulationCorpusManifest({ ...options, now }),
    coverage: buildRegulationCoverageReport({ ...options, now }),
    validation: validateRegulationCorpus({ ...options, now }),
    entries_by_freshness: dashboard.entries_by_freshness,
    ownership_by_type: dashboard.ownership_by_type,
  };
}

export function formatRegulationDashboardMarkdown(dashboard: RegulationCorpusDashboard): string {
  const coverageMd = formatRegulationCoverageMarkdown(dashboard.coverage);
  const lines = [
    coverageMd,
    '',
    '## Knowledge Dashboard',
    '',
    '### Corpus Index',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Fingerprint | \`${dashboard.manifest.fingerprint}\` |`,
    `| Platform version | ${dashboard.manifest.platform_version} |`,
    `| Manifest path | regulation-corpus.manifest.json |`,
    '',
    '### Ownership',
    '',
    '| Owner type | Count |',
    '|------------|------:|',
  ];

  for (const [ownerType, count] of Object.entries(dashboard.ownership_by_type).sort()) {
    lines.push(`| ${ownerType} | ${count} |`);
  }

  lines.push(
    '',
    '### Linkage Coverage',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Entries with rule links | ${dashboard.coverage.linkage_coverage.entries_with_rule_links} |`,
    `| Orphan entries | ${dashboard.coverage.linkage_coverage.entries_orphan} |`,
    `| Demo rules referenced | ${dashboard.coverage.linkage_coverage.demo_rules_referenced}/${dashboard.coverage.linkage_coverage.demo_rules_total} |`,
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
      lines.push(`- \`${issue.regulation_id}\` [${issue.code}]: ${issue.message}`);
    }
    if (dashboard.validation.governance_warnings.length > 15) {
      lines.push(`- … and ${dashboard.validation.governance_warnings.length - 15} more`);
    }
  }

  return lines.join('\n');
}

export function writeRegulationCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
  outputDir?: string;
}): RegulationCorpusDashboard {
  const dashboard = buildRegulationCorpusDashboard(options);
  const reportsDir = options?.outputDir ?? regulationCorpusPlugin.defaultReportsDir();
  writeCorpusDashboard(regulationCorpusPlugin, options);
  const timestamp = dashboard.generated_at.replace(/[:.]/g, '-');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `regulation-corpus-dashboard-${timestamp}.md`),
    `${formatRegulationDashboardMarkdown(dashboard)}\n`,
  );
  return dashboard;
}

export function writeRegulationCoverageReport(options?: {
  customRoot?: string;
  now?: Date;
  outputDir?: string;
}): RegulationCoverageReport {
  writeCorpusCoverageReport(regulationCorpusPlugin, options);
  return buildRegulationCoverageReport(options);
}

export { mapDashboard };
