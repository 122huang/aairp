import { skillCorpusPlugin } from './corpus/skill-corpus.plugin.js';
import { scoreSkillCorpusKqs, type SkillCorpusKqs } from './skill-corpus-kqs.js';
import type { CorpusCoverageReport } from './platform/governance/coverage.js';
import { formatCorpusCoverageMarkdown } from './platform/governance/coverage.js';
import type { SkillCorpusStatus } from './skill-corpus.js';

export type SkillClaimTypeCoverageRow = {
  claim_type_id: string;
  entry_count: number;
  active_count: number;
  coverage_pct: number;
};

export type SkillStatusCoverageRow = {
  skill_status: SkillCorpusStatus;
  entry_count: number;
  coverage_pct: number;
};

export type SkillCoverageReport = {
  generated_at: string;
  corpus_size: number;
  claim_type_coverage: SkillClaimTypeCoverageRow[];
  status_coverage: SkillStatusCoverageRow[];
  missing_claim_types: string[];
  knowledge_quality_score: SkillCorpusKqs;
  freshness: CorpusCoverageReport['freshness'];
  ownership: {
    with_owner: number;
    with_owner_type: number;
    legal_reviewed: number;
    coverage_pct: number;
  };
  linkage_coverage: {
    entries_with_rule_links: number;
    entries_orphan: number;
    rule_linkage_pct: number;
    demo_rules_referenced: number;
    demo_rules_total: number;
    demo_rule_coverage_pct: number;
  };
};

function mapCoverageReport(
  report: CorpusCoverageReport,
  kqs: SkillCorpusKqs,
): SkillCoverageReport {
  return {
    generated_at: report.generated_at,
    corpus_size: report.corpus_size,
    claim_type_coverage: report.primary_coverage.map((row) => ({
      claim_type_id: row.axis_id,
      entry_count: row.entry_count,
      active_count: row.secondary_count ?? 0,
      coverage_pct: row.coverage_pct,
    })),
    status_coverage: report.secondary_coverage.map((row) => ({
      skill_status: row.axis_id as SkillCorpusStatus,
      entry_count: row.entry_count,
      coverage_pct: row.coverage_pct,
    })),
    missing_claim_types: report.missing_primary,
    knowledge_quality_score: kqs,
    freshness: report.freshness,
    ownership: {
      with_owner: report.ownership.with_owner,
      with_owner_type: report.ownership.with_owner_type,
      legal_reviewed: report.ownership.approved_entries,
      coverage_pct: report.ownership.coverage_pct,
    },
    linkage_coverage: {
      entries_with_rule_links: report.linkage_coverage.entries_with_links,
      entries_orphan: report.linkage_coverage.entries_orphan,
      rule_linkage_pct: report.linkage_coverage.linkage_pct,
      demo_rules_referenced: report.linkage_coverage.external_targets_referenced,
      demo_rules_total: report.linkage_coverage.external_targets_total,
      demo_rule_coverage_pct: report.linkage_coverage.external_target_coverage_pct,
    },
  };
}

export function buildSkillCoverageReport(options?: {
  customRoot?: string;
  now?: Date;
}): SkillCoverageReport {
  const now = options?.now ?? new Date();
  const bundle = skillCorpusPlugin.load(options?.customRoot);
  const report = skillCorpusPlugin.buildCoverage(bundle.entries, now);
  return mapCoverageReport(report, scoreSkillCorpusKqs(bundle.entries));
}

export function formatSkillCoverageMarkdown(report: SkillCoverageReport): string {
  const platformReport: CorpusCoverageReport = {
    generated_at: report.generated_at,
    corpus_type: 'skill',
    corpus_size: report.corpus_size,
    primary_coverage: report.claim_type_coverage.map((row) => ({
      axis_id: row.claim_type_id,
      axis_label: row.claim_type_id,
      entry_count: row.entry_count,
      secondary_count: row.active_count,
      secondary_total: row.entry_count,
      coverage_pct: row.coverage_pct,
    })),
    secondary_coverage: report.status_coverage.map((row) => ({
      axis_id: row.skill_status,
      axis_label: row.skill_status,
      entry_count: row.entry_count,
      secondary_count: row.entry_count,
      secondary_total: report.corpus_size,
      coverage_pct: row.coverage_pct,
    })),
    missing_primary: report.missing_claim_types,
    missing_secondary: [],
    knowledge_quality_score: {
      overall: report.knowledge_quality_score.overall,
      entry_count: report.knowledge_quality_score.entry_count,
      dimension_averages: report.knowledge_quality_score.dimension_averages,
      entries: report.knowledge_quality_score.entries.map((row) => ({
        entry_key: row.skill_id,
        knowledge_id: row.knowledge_id,
        overall: row.overall,
        dimensions: row.dimensions,
      })),
      lowest_entries: report.knowledge_quality_score.lowest_entries.map((row) => ({
        entry_key: row.skill_id,
        knowledge_id: row.knowledge_id,
        overall: row.overall,
        dimensions: row.dimensions,
      })),
    },
    freshness: report.freshness,
    ownership: {
      with_owner: report.ownership.with_owner,
      with_owner_type: report.ownership.with_owner_type,
      approved_entries: report.ownership.legal_reviewed,
      coverage_pct: report.ownership.coverage_pct,
    },
    linkage_coverage: {
      entries_with_links: report.linkage_coverage.entries_with_rule_links,
      entries_orphan: report.linkage_coverage.entries_orphan,
      linkage_pct: report.linkage_coverage.rule_linkage_pct,
      external_targets_referenced: report.linkage_coverage.demo_rules_referenced,
      external_targets_total: report.linkage_coverage.demo_rules_total,
      external_target_coverage_pct: report.linkage_coverage.demo_rule_coverage_pct,
    },
  };
  const md = formatCorpusCoverageMarkdown(platformReport, 'Skill Corpus Coverage Report');
  return md
    .replace('## Primary Coverage', '## Claim Type Coverage')
    .replace('## Secondary Coverage', '## Skill Status Coverage')
    .replace('## Missing Primary Values', '## Missing Claim Types')
    .replace('## Missing Secondary Values', '## Missing Status Values')
    .replace('| Linkage coverage |', '| Rule linkage coverage |');
}
