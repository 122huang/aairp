import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRewriteCorpusEntries, type RewriteCorpusEntry } from './rewrite-corpus.js';
import { loadRewriteTemplates } from './rewrite-templates.js';

export type RewriteDriftIssue = {
  severity: 'warn';
  code: string;
  rewrite_id: string;
  message: string;
};

export type RewriteDriftReport = {
  generated_at: string;
  rewrite_corpus_count: number;
  legacy_template_count: number;
  issues: RewriteDriftIssue[];
  summary: {
    templates_with_corpus_entry: number;
    templates_missing_corpus: string[];
    measurable_criteria_drift: number;
    benchmark_template_usage: Record<string, number>;
  };
};

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../');
}

function loadBenchmarkTemplateUsage(): Map<string, number> {
  const benchmarkPath = join(repoRoot(), 'benchmark/benchmark-v3.json');
  const doc = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
    cases: Array<{ expected_rewrite?: { template_id?: string } }>;
  };
  const usage = new Map<string, number>();
  for (const item of doc.cases) {
    const templateId = item.expected_rewrite?.template_id;
    if (templateId) {
      usage.set(templateId, (usage.get(templateId) ?? 0) + 1);
    }
  }
  return usage;
}

export function buildRewriteDriftReport(options?: {
  customRoot?: string;
  now?: Date;
}): RewriteDriftReport {
  const now = options?.now ?? new Date();
  const entries = loadRewriteCorpusEntries(options?.customRoot);
  const legacy = loadRewriteTemplates();
  const benchmarkUsage = loadBenchmarkTemplateUsage();
  const issues: RewriteDriftIssue[] = [];

  const corpusByLegacy = new Map<string, RewriteCorpusEntry>();
  for (const entry of entries) {
    const legacyId = entry.legacy_template_id ?? entry.rewrite_id;
    corpusByLegacy.set(legacyId, entry);
  }

  let measurableDrift = 0;
  for (const template of legacy.templates) {
    const entry = corpusByLegacy.get(template.template_id);
    if (!entry) {
      issues.push({
        severity: 'warn',
        code: 'missing_corpus_entry',
        rewrite_id: template.template_id,
        message: `Legacy template ${template.template_id} has no Rewrite Corpus entry`,
      });
      continue;
    }

    const removeDrift =
      JSON.stringify([...(template.must_remove_terms ?? [])].sort()) !==
      JSON.stringify([...entry.measurable_criteria.must_remove_terms].sort());
    const includeDrift =
      JSON.stringify([...(template.must_include_concepts ?? [])].sort()) !==
      JSON.stringify([...entry.measurable_criteria.must_include_concepts].sort());
    if (removeDrift || includeDrift || template.strategy !== entry.rewrite_strategy_type) {
      measurableDrift += 1;
      issues.push({
        severity: 'warn',
        code: 'measurable_criteria_drift',
        rewrite_id: entry.rewrite_id,
        message: `Measurable criteria or strategy drift from rewrite-templates.json for ${template.template_id}`,
      });
    }

    const usage = benchmarkUsage.get(template.template_id) ?? 0;
    if (usage > 0 && entry.benchmark_refs.length === 0) {
      issues.push({
        severity: 'warn',
        code: 'missing_benchmark_refs',
        rewrite_id: entry.rewrite_id,
        message: `Template ${template.template_id} is used by ${usage} benchmark cases but has no benchmark_refs`,
      });
    }
  }

  const templatesMissing = legacy.templates
    .map((template) => template.template_id)
    .filter((templateId) => !corpusByLegacy.has(templateId));

  return {
    generated_at: now.toISOString(),
    rewrite_corpus_count: entries.length,
    legacy_template_count: legacy.templates.length,
    issues,
    summary: {
      templates_with_corpus_entry: legacy.templates.length - templatesMissing.length,
      templates_missing_corpus: templatesMissing,
      measurable_criteria_drift: measurableDrift,
      benchmark_template_usage: Object.fromEntries(benchmarkUsage.entries()),
    },
  };
}

export function formatRewriteDriftMarkdown(report: RewriteDriftReport): string {
  const lines = [
    '# Rewrite Corpus Drift Report',
    '',
    `Generated: ${report.generated_at}`,
    '',
    'Non-blocking comparison between Rewrite Corpus and `rewrite-templates.json`.',
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Rewrite corpus entries | ${report.rewrite_corpus_count} |`,
    `| Legacy templates | ${report.legacy_template_count} |`,
    `| Templates with corpus entry | ${report.summary.templates_with_corpus_entry} |`,
    `| Measurable criteria drift | ${report.summary.measurable_criteria_drift} |`,
    `| Drift issues | ${report.issues.length} |`,
    '',
  ];

  if (report.summary.templates_missing_corpus.length > 0) {
    lines.push('### Missing corpus entries', '');
    for (const templateId of report.summary.templates_missing_corpus) {
      lines.push(`- \`${templateId}\``);
    }
    lines.push('');
  }

  if (report.issues.length > 0) {
    lines.push('## Drift Issues (sample)', '');
    for (const issue of report.issues.slice(0, 25)) {
      lines.push(`- \`${issue.rewrite_id}\` [${issue.code}]: ${issue.message}`);
    }
    if (report.issues.length > 25) {
      lines.push(`- … and ${report.issues.length - 25} more`);
    }
  } else {
    lines.push('No drift issues detected.', '');
  }

  return lines.join('\n');
}
