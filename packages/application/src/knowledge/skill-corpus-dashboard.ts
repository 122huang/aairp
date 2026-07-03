import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { skillCorpusPlugin } from './corpus/skill-corpus.plugin.js';
import {
  buildCorpusDashboard,
  writeCorpusCoverageReport,
  writeCorpusDashboard,
} from './platform/knowledge-platform.js';
import type { CorpusDashboard } from './platform/governance/dashboard.js';
import { buildSkillCoverageReport, formatSkillCoverageMarkdown } from './skill-corpus-coverage.js';
import { validateSkillCorpus } from './skill-corpus-validator.js';
import { buildSkillCorpusManifest } from './skill-corpus-index.js';
import type { SkillCoverageReport } from './skill-corpus-coverage.js';
import type { SkillValidationResult } from './skill-corpus-validator.js';
import type { SkillCorpusManifest } from './skill-corpus-index.js';

export type SkillCorpusDashboard = {
  generated_at: string;
  manifest: SkillCorpusManifest;
  coverage: SkillCoverageReport;
  validation: SkillValidationResult;
  entries_by_freshness: CorpusDashboard['entries_by_freshness'];
  ownership_by_type: Record<string, number>;
};

export function buildSkillCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
}): SkillCorpusDashboard {
  const now = options?.now ?? new Date();
  const dashboard = buildCorpusDashboard(skillCorpusPlugin, { ...options, now });
  return {
    generated_at: dashboard.generated_at,
    manifest: buildSkillCorpusManifest({ ...options, now }),
    coverage: buildSkillCoverageReport({ ...options, now }),
    validation: validateSkillCorpus({ ...options, now }),
    entries_by_freshness: dashboard.entries_by_freshness,
    ownership_by_type: dashboard.ownership_by_type,
  };
}

export function formatSkillDashboardMarkdown(dashboard: SkillCorpusDashboard): string {
  const coverageMd = formatSkillCoverageMarkdown(dashboard.coverage);
  const lines = [
    coverageMd,
    '',
    '## Skill Corpus Dashboard',
    '',
    '### Corpus Index',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Fingerprint | \`${dashboard.manifest.fingerprint}\` |`,
    `| Platform version | ${dashboard.manifest.platform_version} |`,
    `| Manifest path | skill-corpus.manifest.json |`,
    '',
    '### Skill Status',
    '',
    '| Status | Count |',
    '|--------|------:|',
  ];

  for (const [status, count] of Object.entries(dashboard.manifest.by_status).sort()) {
    lines.push(`| ${status} | ${count} |`);
  }

  lines.push(
    '',
    '### Ownership',
    '',
    '| Owner type | Count |',
    '|------------|------:|',
  );

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
      lines.push(`- \`${issue.skill_id}\` [${issue.code}]: ${issue.message}`);
    }
    if (dashboard.validation.governance_warnings.length > 15) {
      lines.push(`- … and ${dashboard.validation.governance_warnings.length - 15} more`);
    }
  }

  return lines.join('\n');
}

export function writeSkillCorpusDashboard(options?: {
  customRoot?: string;
  now?: Date;
  outputDir?: string;
}): SkillCorpusDashboard {
  const dashboard = buildSkillCorpusDashboard(options);
  const reportsDir = options?.outputDir ?? skillCorpusPlugin.defaultReportsDir();
  writeCorpusDashboard(skillCorpusPlugin, options);
  const timestamp = dashboard.generated_at.replace(/[:.]/g, '-');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `skill-corpus-dashboard-${timestamp}.md`),
    `${formatSkillDashboardMarkdown(dashboard)}\n`,
  );
  return dashboard;
}

export function writeSkillCoverageReport(options?: {
  customRoot?: string;
  now?: Date;
  outputDir?: string;
}): SkillCoverageReport {
  writeCorpusCoverageReport(skillCorpusPlugin, options);
  return buildSkillCoverageReport(options);
}
