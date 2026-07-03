import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadRegulationCorpus,
  listRegulationCategoryNames,
  normalizeRegulationEntry,
  REGULATION_CORPUS_COUNTRY_CODES,
  type RegulationCorpusEntry,
} from '../regulation-corpus.js';
import {
  KNOWLEDGE_PLATFORM_VERSION,
  type KnowledgeCorpusPlugin,
  type CorpusManifest,
} from '../platform/corpus-sdk.js';
import {
  sharedClassificationDimensions,
  scoreCorpusKqs,
  type KqsDimensionDef,
} from '../platform/governance/kqs.js';
import { computeFreshnessStats } from '../platform/governance/freshness.js';
import type { CorpusCoverageReport } from '../platform/governance/coverage.js';
import {
  validateCorpus,
  validateSharedGovernance,
  type ValidationIssue,
} from '../platform/governance/validator.js';
import { fingerprintEntries } from '../platform/governance/dashboard.js';
import {
  hasRegulationOutboundLinkage,
  regulationEntryLinkage,
} from './regulation-entry.adapter.js';
import { loadEvidenceCorpusEntries } from '../evidence-corpus.js';

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
}

function loadDemoRuleIds(): Set<string> {
  const rulesPath = join(repoRoot(), 'demo/rules.demo.json');
  const pack = JSON.parse(readFileSync(rulesPath, 'utf8')) as { rules: Array<{ rule_id: string }> };
  return new Set(pack.rules.map((rule) => rule.rule_id));
}

function loadKnownEvidenceIds(): Set<string> {
  return new Set(loadEvidenceCorpusEntries().map((entry) => entry.knowledge_id));
}

function scoreCitationCompleteness(entry: RegulationCorpusEntry): number {
  const citation = entry.citation?.trim() ?? '';
  if (!citation) {
    return 0;
  }
  if (citation.includes(' — ') && citation.length >= 15) {
    return 1;
  }
  if (citation.length >= 8) {
    return 0.6;
  }
  return 0.3;
}

function scoreSourceQuality(entry: RegulationCorpusEntry): number {
  if (entry.source_url?.startsWith('http')) {
    return 1;
  }
  if (entry.authority && entry.regulation_name && entry.citation) {
    return 0.75;
  }
  if (entry.regulation_name) {
    return 0.4;
  }
  return 0;
}

function scoreRuleLinkage(entry: RegulationCorpusEntry): number {
  if (entry.related_rule_ids.length > 0) {
    return 1;
  }
  return 0.35;
}

const regulationKqsDimensions: KqsDimensionDef<RegulationCorpusEntry>[] = [
  {
    id: 'citation_completeness',
    label: 'Citation completeness',
    score: scoreCitationCompleteness,
  },
  {
    id: 'source_quality',
    label: 'Source quality',
    score: scoreSourceQuality,
  },
  ...sharedClassificationDimensions<RegulationCorpusEntry>(),
  {
    id: 'rule_linkage',
    label: 'Rule linkage',
    score: scoreRuleLinkage,
  },
];

function validateRegulationStructure(
  entry: RegulationCorpusEntry,
  context: { knownRuleIds?: Set<string>; knownEvidenceIds?: Set<string> },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    normalizeRegulationEntry(entry);
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'invalid_entry',
      entry_key: entry.regulation_id ?? 'unknown',
      knowledge_id: entry.knowledge_id ?? 'unknown',
      message: error instanceof Error ? error.message : String(error),
    });
    return issues;
  }

  for (const ruleId of entry.related_rule_ids) {
    if (context.knownRuleIds && !context.knownRuleIds.has(ruleId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_rule_link',
        entry_key: entry.regulation_id,
        knowledge_id: entry.knowledge_id,
        message: `related_rule_ids references unknown rule: ${ruleId}`,
      });
    }
  }

  for (const evidenceId of entry.related_evidence_ids) {
    if (!evidenceId.startsWith('evidence:')) {
      issues.push({
        severity: 'error',
        code: 'invalid_evidence_link',
        entry_key: entry.regulation_id,
        knowledge_id: entry.knowledge_id,
        message: `related_evidence_ids must use evidence: prefix: ${evidenceId}`,
      });
      continue;
    }
    if (context.knownEvidenceIds && !context.knownEvidenceIds.has(evidenceId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_evidence_link',
        entry_key: entry.regulation_id,
        knowledge_id: entry.knowledge_id,
        message: `related_evidence_ids references unknown evidence: ${evidenceId}`,
      });
    }
  }

  return issues;
}

function validateRegulationGovernance(
  entry: RegulationCorpusEntry,
  context: { now: Date },
): ValidationIssue[] {
  return validateSharedGovernance(entry, {
    getEntryKey: (item) => item.regulation_id,
    hasOutboundLinkage: hasRegulationOutboundLinkage,
  }, context);
}

function buildRegulationCoverage(entries: RegulationCorpusEntry[], now: Date): CorpusCoverageReport {
  const corpus = loadRegulationCorpus();
  const categoryNames = listRegulationCategoryNames(corpus.categories);
  const countriesTotal = REGULATION_CORPUS_COUNTRY_CODES.length;
  const categoriesTotal = categoryNames.length;
  const demoRuleIds = loadDemoRuleIds();

  const primary_coverage = corpus.countries.countries.map((country) => {
    const countryEntries = entries.filter((entry) => entry.country === country.country_code);
    const categoriesPresent = new Set(countryEntries.map((entry) => entry.category));
    return {
      axis_id: country.country_code,
      axis_label: `${country.country_code} (${country.name})`,
      entry_count: countryEntries.length,
      secondary_count: categoriesPresent.size,
      secondary_total: categoriesTotal,
      coverage_pct: Math.round((categoriesPresent.size / categoriesTotal) * 1000) / 10,
    };
  });

  const secondary_coverage = categoryNames.map((category) => {
    const categoryEntries = entries.filter((entry) => entry.category === category);
    const countriesPresent = new Set(categoryEntries.map((entry) => entry.country));
    return {
      axis_id: category,
      axis_label: category,
      entry_count: categoryEntries.length,
      secondary_count: countriesPresent.size,
      secondary_total: countriesTotal,
      coverage_pct: Math.round((countriesPresent.size / countriesTotal) * 1000) / 10,
    };
  });

  const missing_primary = REGULATION_CORPUS_COUNTRY_CODES.filter(
    (code) => !entries.some((entry) => entry.country === code),
  );

  const missing_secondary = categoryNames.filter(
    (category) => !entries.some((entry) => entry.category === category),
  );

  let linked = 0;
  const referencedExternal = new Set<string>();
  for (const entry of entries) {
    if (entry.related_rule_ids.length > 0) {
      linked += 1;
      for (const ruleId of entry.related_rule_ids) {
        referencedExternal.add(ruleId);
      }
    }
  }

  const corpusSize = entries.length || 1;
  const withOwner = entries.filter((entry) => Boolean(entry.owner)).length;
  const withOwnerType = entries.filter((entry) => Boolean(entry.owner_type)).length;
  const approved = entries.filter((entry) => entry.review_status === 'legal_reviewed').length;

  return {
    generated_at: now.toISOString(),
    corpus_type: 'regulation',
    corpus_size: entries.length,
    primary_coverage,
    secondary_coverage,
    missing_primary,
    missing_secondary,
    knowledge_quality_score: scoreCorpusKqs(entries, regulationKqsDimensions, (entry) => entry.regulation_id),
    freshness: computeFreshnessStats(entries, now),
    ownership: {
      with_owner: withOwner,
      with_owner_type: withOwnerType,
      approved_entries: approved,
      coverage_pct: Math.round((withOwner / corpusSize) * 1000) / 10,
    },
    linkage_coverage: {
      entries_with_links: linked,
      entries_orphan: entries.length - linked,
      linkage_pct: Math.round((linked / corpusSize) * 1000) / 10,
      external_targets_referenced: referencedExternal.size,
      external_targets_total: demoRuleIds.size,
      external_target_coverage_pct: Math.round((referencedExternal.size / demoRuleIds.size) * 1000) / 10,
    },
  };
}

function buildRegulationManifest(
  entries: RegulationCorpusEntry[],
  root: string,
  now: Date,
): CorpusManifest {
  const corpus = loadRegulationCorpus(root);
  const kqs = scoreCorpusKqs(entries, regulationKqsDimensions, (entry) => entry.regulation_id);
  const by_country: Record<string, number> = {};
  for (const code of REGULATION_CORPUS_COUNTRY_CODES) {
    by_country[code] = entries.filter((entry) => entry.country === code).length;
  }
  const by_category: Record<string, number> = {};
  for (const name of listRegulationCategoryNames(corpus.categories)) {
    by_category[name] = entries.filter((entry) => entry.category === name).length;
  }

  return {
    schema_version: '1.0.0',
    platform_version: KNOWLEDGE_PLATFORM_VERSION,
    corpus_type: 'regulation',
    generated_at: now.toISOString(),
    corpus_root: root,
    fingerprint: fingerprintEntries(entries, (entry) =>
      `${entry.knowledge_id}|${entry.last_reviewed}|${entry.citation}|${entry.summary}|${entry.related_rule_ids.join(',')}`,
    ),
    entry_count: entries.length,
    knowledge_quality_score: kqs.overall,
    freshness: computeFreshnessStats(entries, now),
    knowledge_ids: entries.map((entry) => entry.knowledge_id).sort(),
    dimensions: { by_country, by_category },
    manifest_filename: 'regulation-corpus.manifest.json',
    metadata: {
      countries: [...REGULATION_CORPUS_COUNTRY_CODES],
      categories: listRegulationCategoryNames(corpus.categories),
    },
  };
}

export const regulationCorpusPlugin: KnowledgeCorpusPlugin<RegulationCorpusEntry> = {
  corpus_type: 'regulation',
  platform_version: KNOWLEDGE_PLATFORM_VERSION,
  dashboardTitle: 'Regulation Corpus Dashboard',
  coverageTitle: 'Regulation Corpus Coverage Report',
  manifest_filename: 'regulation-corpus.manifest.json',
  load(customRoot?: string) {
    const corpus = loadRegulationCorpus(customRoot);
    return { root: corpus.root, entries: corpus.entries };
  },
  getEntryKey: (entry) => entry.regulation_id,
  getLinkage: regulationEntryLinkage,
  kqsDimensions: regulationKqsDimensions,
  buildCoverage: buildRegulationCoverage,
  buildManifest: buildRegulationManifest,
  validate(entries, context) {
    const knownEvidenceIds = loadKnownEvidenceIds();
    return validateCorpus(entries, {
      corpus_type: 'regulation',
      getEntryKey: (entry) => entry.regulation_id,
      validateStructure: (entry, ctx) =>
        validateRegulationStructure(entry, { knownRuleIds: ctx.knownRuleIds, knownEvidenceIds }),
      validateGovernance: validateRegulationGovernance,
      getDedupeKeys: (entry) => [{ code: 'duplicate_citation', key: entry.citation }],
    }, context);
  },
  knownRuleIds: loadDemoRuleIds,
  defaultReportsDir: () => join(repoRoot(), 'reports'),
  fingerprintEntry: (entry) =>
    `${entry.knowledge_id}|${entry.last_reviewed}|${entry.citation}|${entry.summary}|${entry.related_rule_ids.join(',')}`,
};

export { regulationKqsDimensions };
