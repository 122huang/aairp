import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { KnowledgeEntryBase } from '../knowledge-entry.js';
import { groupEntriesByFreshnessBand } from './freshness.js';
import { formatCorpusCoverageMarkdown, type CorpusCoverageReport } from './coverage.js';
import type { KnowledgeCorpusPlugin, CorpusManifest } from '../corpus-sdk.js';
import type { ValidationResult } from './validator.js';

export type CorpusDashboard = {
  generated_at: string;
  corpus_type: string;
  manifest: CorpusManifest;
  coverage: CorpusCoverageReport;
  validation: ValidationResult;
  entries_by_freshness: ReturnType<typeof groupEntriesByFreshnessBand>;
  ownership_by_type: Record<string, number>;
};

export function buildCorpusDashboard<T extends KnowledgeEntryBase>(
  plugin: KnowledgeCorpusPlugin<T>,
  options?: { customRoot?: string; now?: Date },
): CorpusDashboard {
  const now = options?.now ?? new Date();
  const bundle = plugin.load(options?.customRoot);
  const entries = bundle.entries;
  const manifest = plugin.buildManifest(entries, bundle.root, now);
  const coverage = plugin.buildCoverage(entries, now);
  const validation = plugin.validate(entries, { now, knownRuleIds: plugin.knownRuleIds?.() });

  const ownership_by_type: Record<string, number> = {};
  for (const entry of entries) {
    ownership_by_type[entry.owner_type] = (ownership_by_type[entry.owner_type] ?? 0) + 1;
  }

  return {
    generated_at: now.toISOString(),
    corpus_type: plugin.corpus_type,
    manifest,
    coverage,
    validation,
    entries_by_freshness: groupEntriesByFreshnessBand(entries, plugin.getEntryKey, now),
    ownership_by_type,
  };
}

export function formatCorpusDashboardMarkdown(dashboard: CorpusDashboard, title: string): string {
  const coverageMd = formatCorpusCoverageMarkdown(dashboard.coverage, title);
  const lines = [
    coverageMd,
    '',
    '## Knowledge Platform Dashboard',
    '',
    '### Corpus Index',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Fingerprint | \`${dashboard.manifest.fingerprint}\` |`,
    `| Manifest | ${dashboard.manifest.manifest_filename} |`,
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
      lines.push(`- \`${issue.entry_key}\` [${issue.code}]: ${issue.message}`);
    }
    if (dashboard.validation.governance_warnings.length > 15) {
      lines.push(`- … and ${dashboard.validation.governance_warnings.length - 15} more`);
    }
  }

  return lines.join('\n');
}

export function writeCorpusDashboard<T extends KnowledgeEntryBase>(
  plugin: KnowledgeCorpusPlugin<T>,
  options?: { customRoot?: string; now?: Date; outputDir?: string },
): CorpusDashboard {
  const dashboard = buildCorpusDashboard(plugin, options);
  const reportsDir = options?.outputDir ?? plugin.defaultReportsDir();
  mkdirSync(reportsDir, { recursive: true });
  const timestamp = dashboard.generated_at.replace(/[:.]/g, '-');
  const prefix = `${plugin.corpus_type}-corpus-dashboard-${timestamp}`;
  writeFileSync(join(reportsDir, `${prefix}.json`), `${JSON.stringify(dashboard, null, 2)}\n`, 'utf8');
  writeFileSync(
    join(reportsDir, `${prefix}.md`),
    `${formatCorpusDashboardMarkdown(dashboard, plugin.dashboardTitle)}\n`,
  );
  return dashboard;
}

export function fingerprintEntries<T>(
  entries: T[],
  serialize: (entry: T) => string,
): string {
  const payload = entries.map(serialize).sort().join('\n');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function writeCorpusManifest<T extends KnowledgeEntryBase>(
  plugin: KnowledgeCorpusPlugin<T>,
  options?: { customRoot?: string; now?: Date },
): CorpusManifest {
  const now = options?.now ?? new Date();
  const bundle = plugin.load(options?.customRoot);
  const manifest = plugin.buildManifest(bundle.entries, bundle.root, now);
  writeFileSync(join(bundle.root, manifest.manifest_filename), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export function writeCorpusCoverageReport<T extends KnowledgeEntryBase>(
  plugin: KnowledgeCorpusPlugin<T>,
  options?: { customRoot?: string; now?: Date; outputDir?: string },
): CorpusCoverageReport {
  const now = options?.now ?? new Date();
  const bundle = plugin.load(options?.customRoot);
  const report = plugin.buildCoverage(bundle.entries, now);
  const reportsDir = options?.outputDir ?? plugin.defaultReportsDir();
  mkdirSync(reportsDir, { recursive: true });
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  writeFileSync(
    join(reportsDir, `${plugin.corpus_type}-coverage-${timestamp}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(
    join(reportsDir, `${plugin.corpus_type}-coverage-${timestamp}.md`),
    `${formatCorpusCoverageMarkdown(report, plugin.coverageTitle)}\n`,
  );
  return report;
}
