import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isActiveRewriteStatus,
  isIndependentRewriteLinkage,
  loadRewriteCorpus,
  loadRewriteStrategies,
  normalizeRewriteCorpusEntry,
  requiresRegulationLinkage,
  requiresSkillLinkage,
  type RewriteCorpusEntry,
} from '../rewrite-corpus.js';
import { loadRegulationCorpusEntries } from '../regulation-corpus.js';
import { loadSkillCorpusEntries } from '../skill-corpus.js';
import { loadCaseCorpusEntries } from '../case-corpus.js';
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
import { hasRewriteOutboundLinkage, rewriteEntryLinkage } from './rewrite-entry.adapter.js';

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
}

function loadDemoRuleIds(): Set<string> {
  const rulesPath = join(repoRoot(), 'demo/rules.demo.json');
  const pack = JSON.parse(readFileSync(rulesPath, 'utf8')) as { rules: Array<{ rule_id: string }> };
  return new Set(pack.rules.map((rule) => rule.rule_id));
}

function loadKnownRegulationIds(): Set<string> {
  return new Set(loadRegulationCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadKnownSkillIds(): Set<string> {
  return new Set(loadSkillCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadBenchmarkCaseIds(): Set<string> {
  const benchmarkPath = join(repoRoot(), 'benchmark/benchmark-v3.json');
  const doc = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
    cases: Array<{ case_id: string }>;
  };
  return new Set(doc.cases.map((item) => item.case_id));
}

function loadKnownCaseIds(): Set<string> {
  return new Set(loadCaseCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadLegacyRewriteTemplates(): Map<
  string,
  { strategy: string; must_remove_terms: string[]; must_include_concepts: string[] }
> {
  const templatesPath = join(repoRoot(), 'docs/knowledge/rewrite-templates.json');
  const doc = JSON.parse(readFileSync(templatesPath, 'utf8')) as {
    templates: Array<{
      template_id: string;
      strategy: string;
      must_remove_terms?: string[];
      must_include_concepts?: string[];
    }>;
  };
  return new Map(
    doc.templates.map((template) => [
      template.template_id,
      {
        strategy: template.strategy,
        must_remove_terms: template.must_remove_terms ?? [],
        must_include_concepts: template.must_include_concepts ?? [],
      },
    ]),
  );
}

function buildSkillRewriteIndex(): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const skill of loadSkillCorpusEntries()) {
    for (const rewriteId of skill.linkage.rewrites ?? []) {
      const bucket = index.get(rewriteId) ?? new Set<string>();
      bucket.add(skill.knowledge_id);
      index.set(rewriteId, bucket);
    }
  }
  return index;
}

function scoreRewritePurpose(entry: RewriteCorpusEntry): number {
  const purpose = entry.rewrite_purpose?.trim() ?? '';
  if (purpose.length >= 40) {
    return 1;
  }
  if (purpose.length >= 20) {
    return 0.6;
  }
  return 0;
}

function scoreRewriteGuidance(entry: RewriteCorpusEntry): number {
  const guidance = entry.rewrite_guidance?.trim() ?? '';
  if (guidance.length >= 60) {
    return 1;
  }
  if (guidance.length >= 20) {
    return 0.6;
  }
  return 0;
}

function scoreMeasurableCriteria(entry: RewriteCorpusEntry): number {
  const criteria = entry.measurable_criteria;
  if (criteria.must_remove_terms.length > 0 || criteria.must_include_concepts.length > 0) {
    return 1;
  }
  if (entry.rewrite_strategy_type === 'cite_evidence' && criteria.must_include_concepts.length > 0) {
    return 1;
  }
  return 0.4;
}

function scoreBenchmarkRefs(entry: RewriteCorpusEntry): number {
  return entry.benchmark_refs.length > 0 ? 1 : 0;
}

function scoreRegulationLinkage(entry: RewriteCorpusEntry): number {
  if (entry.regulation_scope === 'independent') {
    return 1;
  }
  if ((entry.linkage.regulations?.length ?? 0) > 0) {
    return 1;
  }
  return 0;
}

function scoreRuleLinkage(entry: RewriteCorpusEntry): number {
  return (entry.linkage.rules?.length ?? 0) > 0 ? 1 : 0.35;
}

function scoreSkillLinkage(entry: RewriteCorpusEntry): number {
  if (isIndependentRewriteLinkage(entry)) {
    return 1;
  }
  return (entry.linkage.skills?.length ?? 0) > 0 ? 1 : 0.35;
}

function scoreExpectedEvidence(entry: RewriteCorpusEntry): number {
  if (entry.rewrite_strategy_type === 'cite_evidence') {
    return entry.expected_evidence_type && entry.expected_evidence_type !== 'none' ? 1 : 0;
  }
  return entry.expected_evidence_type ? 1 : 0.6;
}

const rewriteKqsDimensions: KqsDimensionDef<RewriteCorpusEntry>[] = [
  { id: 'rewrite_purpose', label: 'Rewrite purpose', score: scoreRewritePurpose },
  { id: 'rewrite_guidance', label: 'Rewrite guidance', score: scoreRewriteGuidance },
  { id: 'measurable_criteria', label: 'Measurable criteria', score: scoreMeasurableCriteria },
  ...sharedClassificationDimensions<RewriteCorpusEntry>(),
  { id: 'regulation_linkage', label: 'Regulation linkage', score: scoreRegulationLinkage },
  { id: 'rule_linkage', label: 'Rule linkage', score: scoreRuleLinkage },
  { id: 'skill_linkage', label: 'Skill linkage', score: scoreSkillLinkage },
  { id: 'benchmark_refs', label: 'Benchmark refs', score: scoreBenchmarkRefs },
  { id: 'expected_evidence', label: 'Expected evidence type', score: scoreExpectedEvidence },
];

function validateRewriteStructure(
  entry: RewriteCorpusEntry,
  context: {
    knownRuleIds?: Set<string>;
    knownRegulationIds?: Set<string>;
    knownSkillIds?: Set<string>;
    knownBenchmarkCaseIds?: Set<string>;
    knownCaseIds?: Set<string>;
    legacyTemplates?: Map<
      string,
      { strategy: string; must_remove_terms: string[]; must_include_concepts: string[] }
    >;
    skillRewriteIndex?: Map<string, Set<string>>;
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    normalizeRewriteCorpusEntry(entry);
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'invalid_entry',
      entry_key: entry.rewrite_id ?? 'unknown',
      knowledge_id: entry.knowledge_id ?? 'unknown',
      message: error instanceof Error ? error.message : String(error),
    });
    return issues;
  }

  if (requiresRegulationLinkage(entry)) {
    if ((entry.linkage.regulations?.length ?? 0) === 0) {
      issues.push({
        severity: 'error',
        code: 'missing_regulation_linkage',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message:
          'Active rewrite must link to at least one regulation knowledge_id (or declare regulation_scope: independent)',
      });
    }
  }

  if (requiresSkillLinkage(entry) && (entry.linkage.skills?.length ?? 0) === 0) {
    issues.push({
      severity: 'error',
      code: 'missing_skill_linkage',
      entry_key: entry.rewrite_id,
      knowledge_id: entry.knowledge_id,
      message: 'Active rewrite must link to at least one skill knowledge_id (or declare rewrite_linkage_scope: independent)',
    });
  }

  if (isActiveRewriteStatus(entry.rewrite_status) && (entry.linkage.rules?.length ?? 0) === 0) {
    issues.push({
      severity: 'error',
      code: 'missing_rule_linkage',
      entry_key: entry.rewrite_id,
      knowledge_id: entry.knowledge_id,
      message: 'Active rewrite must link to at least one rule ID',
    });
  }

  for (const regulationId of entry.linkage.regulations ?? []) {
    if (context.knownRegulationIds && !context.knownRegulationIds.has(regulationId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_regulation_link',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.regulations references unknown regulation: ${regulationId}`,
      });
    }
  }

  for (const ruleId of entry.linkage.rules ?? []) {
    if (context.knownRuleIds && !context.knownRuleIds.has(ruleId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_rule_link',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.rules references unknown rule: ${ruleId}`,
      });
    }
  }

  for (const skillId of entry.linkage.skills ?? []) {
    if (context.knownSkillIds && !context.knownSkillIds.has(skillId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_skill_link',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.skills references unknown skill: ${skillId}`,
      });
    }
  }

  for (const caseRef of entry.benchmark_refs) {
    if (context.knownBenchmarkCaseIds && !context.knownBenchmarkCaseIds.has(caseRef)) {
      issues.push({
        severity: 'error',
        code: 'invalid_benchmark_ref',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message: `benchmark_refs references unknown benchmark-v3 case_id: ${caseRef}`,
      });
    }
  }

  for (const caseRef of entry.case_refs) {
    if (!caseRef.startsWith('case:')) {
      issues.push({
        severity: 'error',
        code: 'invalid_case_ref',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message: `case_refs must use case: prefix: ${caseRef}`,
      });
      continue;
    }
    if (context.knownCaseIds && caseRef.length > 5 && !context.knownCaseIds.has(caseRef)) {
      issues.push({
        severity: 'warn',
        code: 'unknown_case_ref',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message: `case_refs references unknown Case Corpus entry: ${caseRef}`,
      });
    }
  }

  const legacyId = entry.legacy_template_id ?? entry.rewrite_id;
  const legacy = context.legacyTemplates?.get(legacyId);
  if (legacy) {
    if (legacy.strategy !== entry.rewrite_strategy_type) {
      issues.push({
        severity: 'warn',
        code: 'legacy_strategy_drift',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message: `rewrite_strategy_type ${entry.rewrite_strategy_type} differs from legacy template strategy ${legacy.strategy}`,
      });
    }
  } else if (entry.legacy_template_id) {
    issues.push({
      severity: 'warn',
      code: 'unknown_legacy_template',
      entry_key: entry.rewrite_id,
      knowledge_id: entry.knowledge_id,
      message: `legacy_template_id not found in rewrite-templates.json: ${entry.legacy_template_id}`,
    });
  }

  const skillRefs = context.skillRewriteIndex?.get(entry.knowledge_id) ?? new Set<string>();
  for (const skillId of entry.linkage.skills ?? []) {
    if (!skillRefs.has(skillId)) {
      issues.push({
        severity: 'warn',
        code: 'asymmetric_skill_rewrite_link',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message: `skill ${skillId} is linked from rewrite but does not link back via linkage.rewrites`,
      });
    }
  }
  for (const skillId of skillRefs) {
    if (!(entry.linkage.skills ?? []).includes(skillId)) {
      issues.push({
        severity: 'warn',
        code: 'asymmetric_skill_rewrite_link',
        entry_key: entry.rewrite_id,
        knowledge_id: entry.knowledge_id,
        message: `skill ${skillId} links rewrite via linkage.rewrites but rewrite does not link back via linkage.skills`,
      });
    }
  }

  return issues;
}

function validateRewriteGovernance(
  entry: RewriteCorpusEntry,
  context: { now: Date },
): ValidationIssue[] {
  return validateSharedGovernance(entry, {
    getEntryKey: (item) => item.rewrite_id,
    hasOutboundLinkage: hasRewriteOutboundLinkage,
  }, context);
}

function buildRewriteCoverage(entries: RewriteCorpusEntry[], now: Date): CorpusCoverageReport {
  const strategies = loadRewriteStrategies();
  const strategyTypes = strategies.rewrite_strategy_types.map((item) => item.strategy_type);
  const demoRuleIds = loadDemoRuleIds();

  const primary_coverage = strategyTypes.map((strategyType) => {
    const matched = entries.filter((entry) => entry.rewrite_strategy_type === strategyType);
    return {
      axis_id: strategyType,
      axis_label: strategyType,
      entry_count: matched.length,
      secondary_count: matched.filter((entry) => isActiveRewriteStatus(entry.rewrite_status)).length,
      secondary_total: matched.length,
      coverage_pct: matched.length > 0 ? 100 : 0,
    };
  });

  const statusCounts = new Map<string, number>();
  for (const entry of entries) {
    statusCounts.set(entry.rewrite_status, (statusCounts.get(entry.rewrite_status) ?? 0) + 1);
  }

  const secondary_coverage = [...statusCounts.entries()].map(([status, count]) => ({
    axis_id: status,
    axis_label: status,
    entry_count: count,
    secondary_count: count,
    secondary_total: entries.length,
    coverage_pct: entries.length > 0 ? Math.round((count / entries.length) * 1000) / 10 : 0,
  }));

  const missing_primary = strategyTypes.filter(
    (strategyType) => !entries.some((entry) => entry.rewrite_strategy_type === strategyType),
  );

  let linked = 0;
  const referencedExternal = new Set<string>();
  for (const entry of entries) {
    if ((entry.linkage.rules?.length ?? 0) > 0) {
      linked += 1;
      for (const ruleId of entry.linkage.rules ?? []) {
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
    corpus_type: 'rewrite',
    corpus_size: entries.length,
    primary_coverage,
    secondary_coverage,
    missing_primary,
    missing_secondary: [],
    knowledge_quality_score: scoreCorpusKqs(entries, rewriteKqsDimensions, (entry) => entry.rewrite_id),
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

function buildRewriteManifest(
  entries: RewriteCorpusEntry[],
  root: string,
  now: Date,
): CorpusManifest {
  const strategies = loadRewriteStrategies(root);
  const kqs = scoreCorpusKqs(entries, rewriteKqsDimensions, (entry) => entry.rewrite_id);
  const by_strategy: Record<string, number> = {};
  for (const strategy of strategies.rewrite_strategy_types) {
    by_strategy[strategy.strategy_type] = entries.filter(
      (entry) => entry.rewrite_strategy_type === strategy.strategy_type,
    ).length;
  }
  const by_status: Record<string, number> = {};
  for (const entry of entries) {
    by_status[entry.rewrite_status] = (by_status[entry.rewrite_status] ?? 0) + 1;
  }

  return {
    schema_version: '1.0.0',
    platform_version: KNOWLEDGE_PLATFORM_VERSION,
    corpus_type: 'rewrite',
    generated_at: now.toISOString(),
    corpus_root: root,
    fingerprint: fingerprintEntries(entries, (entry) =>
      `${entry.knowledge_id}|${entry.rewrite_version}|${entry.last_reviewed}|${entry.rewrite_status}|${entry.measurable_criteria.must_remove_terms.join(',')}`,
    ),
    entry_count: entries.length,
    knowledge_quality_score: kqs.overall,
    freshness: computeFreshnessStats(entries, now),
    knowledge_ids: entries.map((entry) => entry.knowledge_id).sort(),
    dimensions: { by_strategy, by_status },
    manifest_filename: 'rewrite-corpus.manifest.json',
    metadata: {
      strategy_types: strategies.rewrite_strategy_types.map((item) => item.strategy_type),
    },
  };
}

export const rewriteCorpusPlugin: KnowledgeCorpusPlugin<RewriteCorpusEntry> = {
  corpus_type: 'rewrite',
  platform_version: KNOWLEDGE_PLATFORM_VERSION,
  dashboardTitle: 'Rewrite Corpus Dashboard',
  coverageTitle: 'Rewrite Corpus Coverage Report',
  manifest_filename: 'rewrite-corpus.manifest.json',
  load(customRoot?: string) {
    const corpus = loadRewriteCorpus(customRoot);
    return { root: corpus.root, entries: corpus.entries };
  },
  getEntryKey: (entry) => entry.rewrite_id,
  getLinkage: rewriteEntryLinkage,
  kqsDimensions: rewriteKqsDimensions,
  buildCoverage: buildRewriteCoverage,
  buildManifest: buildRewriteManifest,
  validate(entries, context) {
    const knownRegulationIds = loadKnownRegulationIds();
    const knownSkillIds = loadKnownSkillIds();
    const knownBenchmarkCaseIds = loadBenchmarkCaseIds();
    const knownCaseIds = loadKnownCaseIds();
    const legacyTemplates = loadLegacyRewriteTemplates();
    const skillRewriteIndex = buildSkillRewriteIndex();
    return validateCorpus(entries, {
      corpus_type: 'rewrite',
      getEntryKey: (entry) => entry.rewrite_id,
      validateStructure: (entry, ctx) =>
        validateRewriteStructure(entry, {
          knownRuleIds: ctx.knownRuleIds,
          knownRegulationIds,
          knownSkillIds,
          knownBenchmarkCaseIds,
          knownCaseIds,
          legacyTemplates,
          skillRewriteIndex,
        }),
      validateGovernance: validateRewriteGovernance,
      getDedupeKeys: (entry) => [{ code: 'duplicate_rewrite_purpose', key: entry.rewrite_purpose }],
    }, context);
  },
  knownRuleIds: loadDemoRuleIds,
  defaultReportsDir: () => join(repoRoot(), 'reports'),
  fingerprintEntry: (entry) =>
    `${entry.knowledge_id}|${entry.rewrite_version}|${entry.last_reviewed}|${entry.rewrite_status}|${entry.measurable_criteria.must_remove_terms.join(',')}`,
};

export { rewriteKqsDimensions };
