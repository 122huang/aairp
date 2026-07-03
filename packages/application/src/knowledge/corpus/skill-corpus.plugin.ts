import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isActiveSkillStatus,
  loadSkillClaimTypes,
  loadSkillCorpus,
  normalizeSkillCorpusEntry,
  requiresRegulationLinkage,
  type SkillCorpusEntry,
} from '../skill-corpus.js';
import { loadRegulationCorpusEntries } from '../regulation-corpus.js';
import { loadRewriteCorpusEntries } from '../rewrite-corpus.js';
import { loadEvidenceCorpusEntries } from '../evidence-corpus.js';
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
import { hasSkillOutboundLinkage, skillEntryLinkage } from './skill-entry.adapter.js';

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

function loadBenchmarkCaseIds(): Set<string> {
  const benchmarkPath = join(repoRoot(), 'benchmark/benchmark-v3.json');
  const doc = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
    cases: Array<{ case_id: string }>;
  };
  return new Set(doc.cases.map((item) => item.case_id));
}

function loadPlaybookPatternIds(): Set<string> {
  const playbookPath = join(repoRoot(), 'demo/playbook.demo.md');
  const content = readFileSync(playbookPath, 'utf8');
  const ids = new Set<string>();
  for (const line of content.split('\n')) {
    const match = /^## ([a-z0-9-]+)/.exec(line.trim());
    if (match) {
      ids.add(match[1]!);
    }
  }
  return ids;
}

function loadKnownRewriteIds(): Set<string> {
  return new Set(loadRewriteCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadKnownEvidenceIds(): Set<string> {
  return new Set(loadEvidenceCorpusEntries().map((entry) => entry.knowledge_id));
}

function scoreSkillPurpose(entry: SkillCorpusEntry): number {
  const purpose = entry.skill_purpose?.trim() ?? '';
  if (purpose.length >= 40) {
    return 1;
  }
  if (purpose.length >= 20) {
    return 0.6;
  }
  return 0;
}

function scoreInputDefinition(entry: SkillCorpusEntry): number {
  const input = entry.input_definition;
  if (
    input.modalities.length > 0 &&
    input.countries.length > 0 &&
    input.categories.length > 0 &&
    input.claim_types.length > 0
  ) {
    return 1;
  }
  return 0.35;
}

function scoreDetectionPatterns(entry: SkillCorpusEntry): number {
  if (entry.detection_patterns.length === 0) {
    return 0;
  }
  const withPlaybook = entry.detection_patterns.filter((pattern) =>
    Boolean(pattern.playbook_pattern_id),
  ).length;
  return withPlaybook / entry.detection_patterns.length;
}

function scoreSkillBehavior(entry: SkillCorpusEntry): number {
  const actions = entry.skill_behavior.checkpoint_actions ?? [];
  if (actions.length >= 2) {
    return 1;
  }
  if (actions.length === 1) {
    return 0.6;
  }
  return 0.2;
}

function scoreOutputSchema(entry: SkillCorpusEntry): number {
  const fields = entry.output_schema.fields ?? [];
  if (fields.length >= 3) {
    return 1;
  }
  if (fields.length > 0) {
    return 0.5;
  }
  return 0;
}

function scoreRegulationLinkage(entry: SkillCorpusEntry): number {
  if (entry.regulation_scope === 'independent') {
    return 1;
  }
  if ((entry.linkage.regulations?.length ?? 0) > 0) {
    return 1;
  }
  return 0;
}

function scoreRuleLinkage(entry: SkillCorpusEntry): number {
  if ((entry.linkage.rules?.length ?? 0) > 0) {
    return 1;
  }
  return 0.35;
}

function scoreBenchmarkLinkage(entry: SkillCorpusEntry): number {
  if ((entry.linkage.benchmarks?.length ?? 0) > 0) {
    return 1;
  }
  return 0.35;
}

const skillKqsDimensions: KqsDimensionDef<SkillCorpusEntry>[] = [
  { id: 'skill_purpose', label: 'Skill purpose', score: scoreSkillPurpose },
  { id: 'input_definition', label: 'Input definition', score: scoreInputDefinition },
  { id: 'detection_patterns', label: 'Detection patterns', score: scoreDetectionPatterns },
  { id: 'skill_behavior', label: 'Skill behavior', score: scoreSkillBehavior },
  { id: 'output_schema', label: 'Output schema', score: scoreOutputSchema },
  ...sharedClassificationDimensions<SkillCorpusEntry>(),
  { id: 'regulation_linkage', label: 'Regulation linkage', score: scoreRegulationLinkage },
  { id: 'rule_linkage', label: 'Rule linkage', score: scoreRuleLinkage },
  { id: 'benchmark_linkage', label: 'Benchmark linkage', score: scoreBenchmarkLinkage },
];

function validateSkillStructure(
  entry: SkillCorpusEntry,
  context: {
    knownRuleIds?: Set<string>;
    knownRegulationIds?: Set<string>;
    knownBenchmarkCaseIds?: Set<string>;
    knownPlaybookPatternIds?: Set<string>;
    knownRewriteIds?: Set<string>;
    knownEvidenceIds?: Set<string>;
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    normalizeSkillCorpusEntry(entry);
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'invalid_entry',
      entry_key: entry.skill_id ?? 'unknown',
      knowledge_id: entry.knowledge_id ?? 'unknown',
      message: error instanceof Error ? error.message : String(error),
    });
    return issues;
  }

  if (requiresRegulationLinkage(entry)) {
    const regulationCount = entry.linkage.regulations?.length ?? 0;
    if (regulationCount === 0) {
      issues.push({
        severity: 'error',
        code: 'missing_regulation_linkage',
        entry_key: entry.skill_id,
        knowledge_id: entry.knowledge_id,
        message:
          'Active skill must link to at least one regulation knowledge_id (or declare regulation_scope: independent)',
      });
    }
  }

  for (const regulationId of entry.linkage.regulations ?? []) {
    if (context.knownRegulationIds && !context.knownRegulationIds.has(regulationId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_regulation_link',
        entry_key: entry.skill_id,
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
        entry_key: entry.skill_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.rules references unknown rule: ${ruleId}`,
      });
    }
  }

  for (const caseId of entry.linkage.benchmarks ?? []) {
    if (context.knownBenchmarkCaseIds && !context.knownBenchmarkCaseIds.has(caseId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_benchmark_link',
        entry_key: entry.skill_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.benchmarks references unknown case_id: ${caseId}`,
      });
    }
  }

  for (const pattern of entry.detection_patterns) {
    if (
      pattern.playbook_pattern_id &&
      context.knownPlaybookPatternIds &&
      !context.knownPlaybookPatternIds.has(pattern.playbook_pattern_id)
    ) {
      issues.push({
        severity: 'warn',
        code: 'unknown_playbook_pattern',
        entry_key: entry.skill_id,
        knowledge_id: entry.knowledge_id,
        message: `playbook_pattern_id not found in demo playbook: ${pattern.playbook_pattern_id}`,
      });
    }
    if (pattern.rewrite_template_id && context.knownRewriteIds) {
      const rewriteId = `rewrite:${pattern.rewrite_template_id}`;
      if (!context.knownRewriteIds.has(rewriteId)) {
        issues.push({
          severity: 'error',
          code: 'unknown_rewrite_link',
          entry_key: entry.skill_id,
          knowledge_id: entry.knowledge_id,
          message: `rewrite_template_id not found in Rewrite Corpus: ${rewriteId}`,
        });
      }
    }
  }

  for (const rewriteId of entry.linkage.rewrites ?? []) {
    if (context.knownRewriteIds && !context.knownRewriteIds.has(rewriteId)) {
      issues.push({
        severity: 'error',
        code: 'unknown_rewrite_link',
        entry_key: entry.skill_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.rewrites references unknown rewrite knowledge_id: ${rewriteId}`,
      });
    }
  }

  if (
    isActiveSkillStatus(entry.skill_status) &&
    entry.evidence_requirement === 'required' &&
    (entry.linkage.evidence?.length ?? 0) === 0
  ) {
    issues.push({
      severity: 'error',
      code: 'missing_evidence_linkage',
      entry_key: entry.skill_id,
      knowledge_id: entry.knowledge_id,
      message: 'Active skill with evidence_requirement required must link to at least one evidence knowledge_id',
    });
  }

  for (const evidenceId of entry.linkage.evidence ?? []) {
    if (!evidenceId.startsWith('evidence:')) {
      issues.push({
        severity: 'error',
        code: 'invalid_evidence_link',
        entry_key: entry.skill_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.evidence must use evidence: prefix: ${evidenceId}`,
      });
      continue;
    }
    if (context.knownEvidenceIds && !context.knownEvidenceIds.has(evidenceId)) {
      issues.push({
        severity: 'error',
        code: 'unknown_evidence_link',
        entry_key: entry.skill_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.evidence references unknown evidence knowledge_id: ${evidenceId}`,
      });
    }
  }

  return issues;
}

function validateSkillGovernance(
  entry: SkillCorpusEntry,
  context: { now: Date },
): ValidationIssue[] {
  return validateSharedGovernance(entry, {
    getEntryKey: (item) => item.skill_id,
    hasOutboundLinkage: hasSkillOutboundLinkage,
  }, context);
}

function buildSkillCoverage(entries: SkillCorpusEntry[], now: Date): CorpusCoverageReport {
  const claimTypes = loadSkillClaimTypes();
  const claimTypeIds = claimTypes.claim_types.map((item) => item.claim_type_id);
  const demoRuleIds = loadDemoRuleIds();

  const primary_coverage = claimTypeIds.map((claimTypeId) => {
    const matched = entries.filter((entry) =>
      entry.input_definition.claim_types.includes(claimTypeId),
    );
    return {
      axis_id: claimTypeId,
      axis_label: claimTypeId,
      entry_count: matched.length,
      secondary_count: matched.filter((entry) => isActiveSkillStatus(entry.skill_status)).length,
      secondary_total: matched.length,
      coverage_pct: matched.length > 0 ? 100 : 0,
    };
  });

  const statusCounts = new Map<string, number>();
  for (const entry of entries) {
    statusCounts.set(entry.skill_status, (statusCounts.get(entry.skill_status) ?? 0) + 1);
  }

  const secondary_coverage = [...statusCounts.entries()].map(([status, count]) => ({
    axis_id: status,
    axis_label: status,
    entry_count: count,
    secondary_count: count,
    secondary_total: entries.length,
    coverage_pct: entries.length > 0 ? Math.round((count / entries.length) * 1000) / 10 : 0,
  }));

  const missing_primary = claimTypeIds.filter(
    (claimTypeId) => !entries.some((entry) => entry.input_definition.claim_types.includes(claimTypeId)),
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
    corpus_type: 'skill',
    corpus_size: entries.length,
    primary_coverage,
    secondary_coverage,
    missing_primary,
    missing_secondary: [],
    knowledge_quality_score: scoreCorpusKqs(entries, skillKqsDimensions, (entry) => entry.skill_id),
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

function buildSkillManifest(entries: SkillCorpusEntry[], root: string, now: Date): CorpusManifest {
  const claimTypes = loadSkillClaimTypes(root);
  const kqs = scoreCorpusKqs(entries, skillKqsDimensions, (entry) => entry.skill_id);
  const by_claim_type: Record<string, number> = {};
  for (const claimType of claimTypes.claim_types) {
    by_claim_type[claimType.claim_type_id] = entries.filter((entry) =>
      entry.input_definition.claim_types.includes(claimType.claim_type_id),
    ).length;
  }
  const by_status: Record<string, number> = {};
  for (const entry of entries) {
    by_status[entry.skill_status] = (by_status[entry.skill_status] ?? 0) + 1;
  }

  return {
    schema_version: '1.0.0',
    platform_version: KNOWLEDGE_PLATFORM_VERSION,
    corpus_type: 'skill',
    generated_at: now.toISOString(),
    corpus_root: root,
    fingerprint: fingerprintEntries(entries, (entry) =>
      `${entry.knowledge_id}|${entry.skill_version}|${entry.last_reviewed}|${entry.skill_status}|${(entry.linkage.rules ?? []).join(',')}`,
    ),
    entry_count: entries.length,
    knowledge_quality_score: kqs.overall,
    freshness: computeFreshnessStats(entries, now),
    knowledge_ids: entries.map((entry) => entry.knowledge_id).sort(),
    dimensions: { by_claim_type, by_status },
    manifest_filename: 'skill-corpus.manifest.json',
    metadata: {
      claim_types: claimTypes.claim_types.map((item) => item.claim_type_id),
    },
  };
}

export const skillCorpusPlugin: KnowledgeCorpusPlugin<SkillCorpusEntry> = {
  corpus_type: 'skill',
  platform_version: KNOWLEDGE_PLATFORM_VERSION,
  dashboardTitle: 'Skill Corpus Dashboard',
  coverageTitle: 'Skill Corpus Coverage Report',
  manifest_filename: 'skill-corpus.manifest.json',
  load(customRoot?: string) {
    const corpus = loadSkillCorpus(customRoot);
    return { root: corpus.root, entries: corpus.entries };
  },
  getEntryKey: (entry) => entry.skill_id,
  getLinkage: skillEntryLinkage,
  kqsDimensions: skillKqsDimensions,
  buildCoverage: buildSkillCoverage,
  buildManifest: buildSkillManifest,
  validate(entries, context) {
    const knownRegulationIds = loadKnownRegulationIds();
    const knownBenchmarkCaseIds = loadBenchmarkCaseIds();
    const knownPlaybookPatternIds = loadPlaybookPatternIds();
    const knownRewriteIds = loadKnownRewriteIds();
    const knownEvidenceIds = loadKnownEvidenceIds();
    return validateCorpus(entries, {
      corpus_type: 'skill',
      getEntryKey: (entry) => entry.skill_id,
      validateStructure: (entry, ctx) =>
        validateSkillStructure(entry, {
          knownRuleIds: ctx.knownRuleIds,
          knownRegulationIds,
          knownBenchmarkCaseIds,
          knownPlaybookPatternIds,
          knownRewriteIds,
          knownEvidenceIds,
        }),
      validateGovernance: validateSkillGovernance,
      getDedupeKeys: (entry) => [{ code: 'duplicate_skill_purpose', key: entry.skill_purpose }],
    }, context);
  },
  knownRuleIds: loadDemoRuleIds,
  defaultReportsDir: () => join(repoRoot(), 'reports'),
  fingerprintEntry: (entry) =>
    `${entry.knowledge_id}|${entry.skill_version}|${entry.last_reviewed}|${entry.skill_status}|${(entry.linkage.rules ?? []).join(',')}`,
};

export { skillKqsDimensions };
