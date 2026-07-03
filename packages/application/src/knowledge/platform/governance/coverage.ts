import type { KnowledgeEntryBase } from '../knowledge-entry.js';
import { scoreCorpusKqs, type CorpusKqs, type KqsDimensionDef } from './kqs.js';
import { computeFreshnessStats, type KnowledgeFreshnessStats } from './freshness.js';

export type CoverageAxisRow = {
  axis_id: string;
  axis_label: string;
  entry_count: number;
  secondary_count?: number;
  secondary_total?: number;
  coverage_pct: number;
};

export type CorpusCoverageReport = {
  generated_at: string;
  corpus_type: string;
  corpus_size: number;
  primary_coverage: CoverageAxisRow[];
  secondary_coverage: CoverageAxisRow[];
  missing_primary: string[];
  missing_secondary: string[];
  knowledge_quality_score: CorpusKqs;
  freshness: KnowledgeFreshnessStats;
  ownership: {
    with_owner: number;
    with_owner_type: number;
    approved_entries: number;
    coverage_pct: number;
  };
  linkage_coverage: {
    entries_with_links: number;
    entries_orphan: number;
    linkage_pct: number;
    external_targets_referenced: number;
    external_targets_total: number;
    external_target_coverage_pct: number;
  };
};

export type CorpusCoverageHooks<T extends KnowledgeEntryBase> = {
  corpus_type: string;
  getEntryKey: (entry: T) => string;
  kqsDimensions: KqsDimensionDef<T>[];
  primaryAxes: Array<{
    axis_id: string;
    axis_label: string;
    allValues: string[];
    getValue: (entry: T) => string;
    secondaryValues?: string[];
    getSecondaryValue?: (entry: T) => string;
  }>;
  countLinkage: (entries: T[]) => {
    linked: number;
    referencedExternal: Set<string>;
    externalTotal: number;
  };
  isApproved?: (entry: T) => boolean;
};

export function buildCorpusCoverageReport<T extends KnowledgeEntryBase>(
  entries: T[],
  hooks: CorpusCoverageHooks<T>,
  now: Date = new Date(),
): CorpusCoverageReport {
  const primary_coverage: CoverageAxisRow[] = hooks.primaryAxes.map((axis) => {
    const axisEntries = entries.filter((entry) => axis.allValues.includes(axis.getValue(entry)));
    const valuesPresent = new Set(axisEntries.map((entry) => axis.getValue(entry)));
    const secondaryTotal = axis.secondaryValues?.length ?? 0;
    let secondaryCount = 0;
    if (axis.secondaryValues && axis.getSecondaryValue) {
      secondaryCount = new Set(
        axisEntries.map((entry) => axis.getSecondaryValue!(entry)),
      ).size;
    }
    return {
      axis_id: axis.axis_id,
      axis_label: axis.axis_label,
      entry_count: axisEntries.length,
      secondary_count: secondaryTotal > 0 ? secondaryCount : undefined,
      secondary_total: secondaryTotal > 0 ? secondaryTotal : undefined,
      coverage_pct:
        secondaryTotal > 0
          ? Math.round((secondaryCount / secondaryTotal) * 1000) / 10
          : Math.round((valuesPresent.size / axis.allValues.length) * 1000) / 10,
    };
  });

  const secondary_coverage: CoverageAxisRow[] = hooks.primaryAxes
    .filter((axis) => axis.secondaryValues && axis.getSecondaryValue)
    .map((axis) => {
      const secondaryValues = axis.secondaryValues!;
      const getSecondary = axis.getSecondaryValue!;
      const counts = new Map<string, number>();
      const countrySets = new Map<string, Set<string>>();
      for (const value of secondaryValues) {
        counts.set(value, 0);
        countrySets.set(value, new Set());
      }
      for (const entry of entries) {
        const secondary = getSecondary(entry);
        const primary = axis.getValue(entry);
        counts.set(secondary, (counts.get(secondary) ?? 0) + 1);
        countrySets.get(secondary)?.add(primary);
      }
      return secondaryValues.map((value) => ({
        axis_id: value,
        axis_label: value,
        entry_count: counts.get(value) ?? 0,
        secondary_count: countrySets.get(value)?.size ?? 0,
        secondary_total: axis.allValues.length,
        coverage_pct:
          Math.round(((countrySets.get(value)?.size ?? 0) / axis.allValues.length) * 1000) / 10,
      }));
    })
    .flat();

  const missing_primary = hooks.primaryAxes[0]?.allValues.filter(
    (value) => !entries.some((entry) => hooks.primaryAxes[0]!.getValue(entry) === value),
  ) ?? [];

  const missing_secondary =
    hooks.primaryAxes[0]?.secondaryValues?.filter(
      (value) => !entries.some((entry) => hooks.primaryAxes[0]!.getSecondaryValue!(entry) === value),
    ) ?? [];

  const linkage = hooks.countLinkage(entries);
  const corpusSize = entries.length || 1;
  const withOwner = entries.filter((entry) => Boolean(entry.owner)).length;
  const withOwnerType = entries.filter((entry) => Boolean(entry.owner_type)).length;
  const approved = entries.filter((entry) => hooks.isApproved?.(entry) ?? entry.review_status === 'legal_reviewed')
    .length;

  return {
    generated_at: now.toISOString(),
    corpus_type: hooks.corpus_type,
    corpus_size: entries.length,
    primary_coverage,
    secondary_coverage,
    missing_primary,
    missing_secondary,
    knowledge_quality_score: scoreCorpusKqs(entries, hooks.kqsDimensions, hooks.getEntryKey),
    freshness: computeFreshnessStats(entries, now, (entry) => entry.last_reviewed),
    ownership: {
      with_owner: withOwner,
      with_owner_type: withOwnerType,
      approved_entries: approved,
      coverage_pct: Math.round((withOwner / corpusSize) * 1000) / 10,
    },
    linkage_coverage: {
      entries_with_links: linkage.linked,
      entries_orphan: entries.length - linkage.linked,
      linkage_pct: Math.round((linkage.linked / corpusSize) * 1000) / 10,
      external_targets_referenced: linkage.referencedExternal.size,
      external_targets_total: linkage.externalTotal,
      external_target_coverage_pct:
        linkage.externalTotal === 0
          ? 0
          : Math.round((linkage.referencedExternal.size / linkage.externalTotal) * 1000) / 10,
    },
  };
}

export function formatCorpusCoverageMarkdown(report: CorpusCoverageReport, title: string): string {
  const lines = [
    `# ${title}`,
    '',
    `Generated: ${report.generated_at}`,
    `Corpus type: ${report.corpus_type}`,
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Corpus size | ${report.corpus_size} |`,
    `| Knowledge Quality Score | ${report.knowledge_quality_score.overall}% |`,
    `| Freshness green | ${report.freshness.green} (${report.freshness.green_pct}%) |`,
    `| Freshness yellow | ${report.freshness.yellow} (${report.freshness.yellow_pct}%) |`,
    `| Freshness red | ${report.freshness.red} (${report.freshness.red_pct}%) |`,
    `| Ownership coverage | ${report.ownership.coverage_pct}% |`,
    `| Linkage coverage | ${report.linkage_coverage.linkage_pct}% |`,
  ];

  if (report.primary_coverage.length > 0) {
    lines.push('', '## Primary Coverage', '', '| Axis | Entries | Coverage |', '|------|--------:|---------:|');
    for (const row of report.primary_coverage) {
      const secondary =
        row.secondary_count !== undefined && row.secondary_total !== undefined
          ? ` (${row.secondary_count}/${row.secondary_total})`
          : '';
      lines.push(`| ${row.axis_label}${secondary} | ${row.entry_count} | ${row.coverage_pct}% |`);
    }
  }

  if (report.secondary_coverage.length > 0) {
    lines.push('', '## Secondary Coverage', '', '| Label | Entries | Span | Coverage |', '|-------|--------:|-----:|---------:|');
    for (const row of report.secondary_coverage) {
      lines.push(
        `| ${row.axis_label} | ${row.entry_count} | ${row.secondary_count}/${row.secondary_total} | ${row.coverage_pct}% |`,
      );
    }
  }

  lines.push('', '## Missing Primary Values', '');
  if (report.missing_primary.length === 0) {
    lines.push('- None');
  } else {
    for (const value of report.missing_primary) {
      lines.push(`- ${value}`);
    }
  }

  lines.push('', '## Missing Secondary Values', '');
  if (report.missing_secondary.length === 0) {
    lines.push('- None');
  } else {
    for (const value of report.missing_secondary) {
      lines.push(`- ${value}`);
    }
  }

  lines.push(
    '',
    '## KQS Dimension Averages',
    '',
    '| Dimension | Score |',
    '|-----------|------:|',
  );
  for (const [dimension, score] of Object.entries(report.knowledge_quality_score.dimension_averages)) {
    lines.push(`| ${dimension} | ${score}% |`);
  }

  return lines.join('\n');
}
