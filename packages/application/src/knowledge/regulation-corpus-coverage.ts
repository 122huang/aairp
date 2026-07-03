import { regulationCorpusPlugin } from './corpus/regulation-corpus.plugin.js';
import { scoreRegulationCorpusKqs, type RegulationCorpusKqs } from './regulation-corpus-kqs.js';
import type { CorpusCoverageReport } from './platform/governance/coverage.js';
import { formatCorpusCoverageMarkdown } from './platform/governance/coverage.js';
import type { RegulationCategoryName } from './regulation-corpus.js';

export type RegulationCountryCoverageRow = {
  country_code: string;
  country_name: string;
  entry_count: number;
  categories_covered: number;
  categories_total: number;
  coverage_pct: number;
};

export type RegulationCategoryCoverageRow = {
  category: RegulationCategoryName;
  entry_count: number;
  countries_covered: number;
  countries_total: number;
  coverage_pct: number;
};

export type RegulationCoverageReport = {
  generated_at: string;
  corpus_size: number;
  country_coverage: RegulationCountryCoverageRow[];
  category_coverage: RegulationCategoryCoverageRow[];
  missing_categories: RegulationCategoryName[];
  missing_countries: string[];
  knowledge_quality_score: RegulationCorpusKqs;
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

function parseCountryLabel(label: string): { code: string; name: string } {
  const match = /^([A-Z]{2})\s\((.+)\)$/.exec(label);
  if (match) {
    return { code: match[1]!, name: match[2]! };
  }
  return { code: label, name: label };
}

function mapCoverageReport(
  report: CorpusCoverageReport,
  kqs: RegulationCorpusKqs,
): RegulationCoverageReport {
  return {
    generated_at: report.generated_at,
    corpus_size: report.corpus_size,
    country_coverage: report.primary_coverage.map((row) => {
      const { code, name } = parseCountryLabel(row.axis_label);
      return {
        country_code: code,
        country_name: name,
        entry_count: row.entry_count,
        categories_covered: row.secondary_count ?? 0,
        categories_total: row.secondary_total ?? 0,
        coverage_pct: row.coverage_pct,
      };
    }),
    category_coverage: report.secondary_coverage.map((row) => ({
      category: row.axis_label as RegulationCategoryName,
      entry_count: row.entry_count,
      countries_covered: row.secondary_count ?? 0,
      countries_total: row.secondary_total ?? 0,
      coverage_pct: row.coverage_pct,
    })),
    missing_categories: report.missing_secondary as RegulationCategoryName[],
    missing_countries: report.missing_primary,
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

export function buildRegulationCoverageReport(options?: {
  customRoot?: string;
  now?: Date;
}): RegulationCoverageReport {
  const now = options?.now ?? new Date();
  const bundle = regulationCorpusPlugin.load(options?.customRoot);
  const report = regulationCorpusPlugin.buildCoverage(bundle.entries, now);
  return mapCoverageReport(report, scoreRegulationCorpusKqs(bundle.entries));
}

export function formatRegulationCoverageMarkdown(report: RegulationCoverageReport): string {
  const platformReport: CorpusCoverageReport = {
    generated_at: report.generated_at,
    corpus_type: 'regulation',
    corpus_size: report.corpus_size,
    primary_coverage: report.country_coverage.map((row) => ({
      axis_id: row.country_code,
      axis_label: `${row.country_code} (${row.country_name})`,
      entry_count: row.entry_count,
      secondary_count: row.categories_covered,
      secondary_total: row.categories_total,
      coverage_pct: row.coverage_pct,
    })),
    secondary_coverage: report.category_coverage.map((row) => ({
      axis_id: row.category,
      axis_label: row.category,
      entry_count: row.entry_count,
      secondary_count: row.countries_covered,
      secondary_total: row.countries_total,
      coverage_pct: row.coverage_pct,
    })),
    missing_primary: report.missing_countries,
    missing_secondary: report.missing_categories,
    knowledge_quality_score: {
      overall: report.knowledge_quality_score.overall,
      entry_count: report.knowledge_quality_score.entry_count,
      dimension_averages: report.knowledge_quality_score.dimension_averages,
      entries: report.knowledge_quality_score.entries.map((row) => ({
        entry_key: row.regulation_id,
        knowledge_id: row.knowledge_id,
        overall: row.overall,
        dimensions: row.dimensions,
      })),
      lowest_entries: report.knowledge_quality_score.lowest_entries.map((row) => ({
        entry_key: row.regulation_id,
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
  const md = formatCorpusCoverageMarkdown(platformReport, 'Regulation Corpus Coverage Report');
  return md
    .replace('## Primary Coverage', '## Country Coverage')
    .replace('## Secondary Coverage', '## Category Coverage')
    .replace('## Missing Primary Values', '## Missing Countries')
    .replace('## Missing Secondary Values', '## Missing Categories')
    .replace('| Linkage coverage |', '| Rule linkage coverage |');
}
