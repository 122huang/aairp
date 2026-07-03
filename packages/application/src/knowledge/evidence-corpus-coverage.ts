import { evidenceCorpusPlugin, evidenceKqsDimensions } from './corpus/evidence-corpus.plugin.js';
import { scoreCorpusKqs } from './platform/governance/kqs.js';
import type { CorpusCoverageReport } from './platform/governance/coverage.js';
import { formatCorpusCoverageMarkdown } from './platform/governance/coverage.js';
import type { EvidenceCorpusStatus, EvidenceTypeKey } from './evidence-corpus.js';

export type EvidenceTypeCoverageRow = {
  evidence_type_key: EvidenceTypeKey;
  entry_count: number;
  active_count: number;
  coverage_pct: number;
};

export type EvidenceStatusCoverageRow = {
  evidence_status: EvidenceCorpusStatus;
  entry_count: number;
  coverage_pct: number;
};

export type EvidenceCoverageReport = {
  generated_at: string;
  corpus_size: number;
  type_coverage: EvidenceTypeCoverageRow[];
  status_coverage: EvidenceStatusCoverageRow[];
  missing_types: string[];
  knowledge_quality_score: ReturnType<typeof scoreCorpusKqs>;
  freshness: CorpusCoverageReport['freshness'];
  ownership: CorpusCoverageReport['ownership'];
  linkage_coverage: CorpusCoverageReport['linkage_coverage'];
};

export function buildEvidenceCoverageReport(options?: {
  customRoot?: string;
  now?: Date;
}): EvidenceCoverageReport {
  const now = options?.now ?? new Date();
  const bundle = evidenceCorpusPlugin.load(options?.customRoot);
  const report = evidenceCorpusPlugin.buildCoverage(bundle.entries, now);
  const kqs = scoreCorpusKqs(bundle.entries, evidenceKqsDimensions, (entry) => entry.evidence_id);

  return {
    generated_at: report.generated_at,
    corpus_size: report.corpus_size,
    type_coverage: report.primary_coverage.map((row) => ({
      evidence_type_key: row.axis_id as EvidenceTypeKey,
      entry_count: row.entry_count,
      active_count: row.secondary_count ?? 0,
      coverage_pct: row.coverage_pct,
    })),
    status_coverage: report.secondary_coverage.map((row) => ({
      evidence_status: row.axis_id as EvidenceCorpusStatus,
      entry_count: row.entry_count,
      coverage_pct: row.coverage_pct,
    })),
    missing_types: report.missing_primary,
    knowledge_quality_score: kqs,
    freshness: report.freshness,
    ownership: report.ownership,
    linkage_coverage: report.linkage_coverage,
  };
}

export function formatEvidenceCoverageMarkdown(report: EvidenceCoverageReport): string {
  const platformReport: CorpusCoverageReport = {
    generated_at: report.generated_at,
    corpus_type: 'evidence',
    corpus_size: report.corpus_size,
    primary_coverage: report.type_coverage.map((row) => ({
      axis_id: row.evidence_type_key,
      axis_label: row.evidence_type_key,
      entry_count: row.entry_count,
      secondary_count: row.active_count,
      secondary_total: row.entry_count,
      coverage_pct: row.coverage_pct,
    })),
    secondary_coverage: report.status_coverage.map((row) => ({
      axis_id: row.evidence_status,
      axis_label: row.evidence_status,
      entry_count: row.entry_count,
      secondary_count: row.entry_count,
      secondary_total: report.corpus_size,
      coverage_pct: row.coverage_pct,
    })),
    missing_primary: report.missing_types,
    missing_secondary: [],
    knowledge_quality_score: report.knowledge_quality_score,
    freshness: report.freshness,
    ownership: report.ownership,
    linkage_coverage: report.linkage_coverage,
  };
  return formatCorpusCoverageMarkdown(platformReport, 'Evidence Corpus Coverage Report')
    .replace('## Primary Coverage', '## Evidence Type Coverage')
    .replace('## Secondary Coverage', '## Evidence Status Coverage')
    .replace('## Missing Primary Values', '## Missing Evidence Types')
    .replace('## Missing Secondary Values', '## Missing Status Values');
}
