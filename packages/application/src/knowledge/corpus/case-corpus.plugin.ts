import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isActiveCaseStatus,
  loadCaseCorpus,
  loadCaseTaxonomy,
  normalizeCaseCorpusEntry,
  requiresHumanVerificationForVerified,
  verificationRank,
  type CaseCorpusEntry,
} from '../case-corpus.js';
import { loadRegulationCorpusEntries } from '../regulation-corpus.js';
import { loadSkillCorpusEntries } from '../skill-corpus.js';
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
import { hasCaseOutboundLinkage, caseEntryLinkage } from './case-entry.adapter.js';

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
}

function loadDemoRuleIds(): Set<string> {
  const rulesPath = join(repoRoot(), 'demo/rules.demo.json');
  const pack = JSON.parse(readFileSync(rulesPath, 'utf8')) as { rules: Array<{ rule_id: string }> };
  return new Set(pack.rules.map((rule) => rule.rule_id));
}

function loadBenchmarkCaseIds(): Set<string> {
  const benchmarkPath = join(repoRoot(), 'benchmark/benchmark-v3.json');
  const doc = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
    cases: Array<{ case_id: string }>;
  };
  return new Set(doc.cases.map((item) => item.case_id));
}

function loadKnownRegulationIds(): Set<string> {
  return new Set(loadRegulationCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadKnownSkillIds(): Set<string> {
  return new Set(loadSkillCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadKnownRewriteIds(): Set<string> {
  return new Set(loadRewriteCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadKnownEvidenceIds(): Set<string> {
  return new Set(loadEvidenceCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadSkillEvidenceRequirement(): Map<string, string> {
  const map = new Map<string, string>();
  for (const skill of loadSkillCorpusEntries()) {
    map.set(skill.knowledge_id, skill.evidence_requirement ?? 'none');
  }
  return map;
}

function loadRewriteEvidenceRequirement(): Map<string, { requirement: string; strategy: string }> {
  const map = new Map<string, { requirement: string; strategy: string }>();
  for (const rewrite of loadRewriteCorpusEntries()) {
    map.set(rewrite.knowledge_id, {
      requirement: rewrite.evidence_requirement ?? 'none',
      strategy: rewrite.rewrite_strategy_type,
    });
  }
  return map;
}

function entryRequiresEvidenceValidation(
  entry: CaseCorpusEntry,
  skillEvidence: Map<string, string>,
  rewriteEvidence: Map<string, { requirement: string; strategy: string }>,
): boolean {
  for (const skillId of entry.linkage.skills ?? []) {
    if (skillEvidence.get(skillId) === 'required') {
      return true;
    }
  }
  for (const rewriteId of entry.linkage.rewrites ?? []) {
    const rewrite = rewriteEvidence.get(rewriteId);
    if (rewrite?.requirement === 'required' || rewrite?.strategy === 'cite_evidence') {
      return true;
    }
  }
  return false;
}

function scoreCasePurpose(entry: CaseCorpusEntry): number {
  const purpose = entry.case_purpose?.trim() ?? '';
  if (purpose.length >= 40) return 1;
  if (purpose.length >= 20) return 0.6;
  return 0;
}

function scoreGroundTruth(entry: CaseCorpusEntry): number {
  const spec = entry.ground_truth_spec;
  let score = 0;
  if (spec.expected_decision) score += 0.4;
  if (spec.expected_action) score += 0.2;
  if (spec.expected_rule || spec.expected_pattern) score += 0.2;
  if (entry.case_result.decision_outcome) score += 0.2;
  return Math.min(score, 1);
}

function scoreScenarioSpec(entry: CaseCorpusEntry): number {
  const spec = entry.scenario_spec;
  if ((spec.countries?.length ?? 0) > 0 && (spec.claim_types?.length ?? 0) > 0) {
    return 1;
  }
  return 0.35;
}

function scoreBenchmarkRef(entry: CaseCorpusEntry): number {
  return entry.benchmark_ref ? 1 : 0;
}

function scoreVerification(entry: CaseCorpusEntry): number {
  if (entry.verification_status === 'legal_verified') return 1;
  if (entry.verification_status === 'human_verified') return 0.85;
  if (entry.verification_status === 'unverified') return 0.3;
  return 0;
}

function scoreSkillLinkage(entry: CaseCorpusEntry): number {
  return (entry.linkage.skills?.length ?? 0) > 0 ? 1 : 0.35;
}

const caseKqsDimensions: KqsDimensionDef<CaseCorpusEntry>[] = [
  { id: 'case_purpose', label: 'Case purpose', score: scoreCasePurpose },
  { id: 'ground_truth_spec', label: 'Ground truth spec', score: scoreGroundTruth },
  { id: 'scenario_spec', label: 'Scenario spec', score: scoreScenarioSpec },
  { id: 'benchmark_ref', label: 'Benchmark ref', score: scoreBenchmarkRef },
  { id: 'verification_status', label: 'Verification status', score: scoreVerification },
  ...sharedClassificationDimensions<CaseCorpusEntry>(),
  { id: 'skill_linkage', label: 'Skill linkage', score: scoreSkillLinkage },
];

function validateCaseStructure(
  entry: CaseCorpusEntry,
  context: {
    knownRuleIds?: Set<string>;
    knownRegulationIds?: Set<string>;
    knownSkillIds?: Set<string>;
    knownRewriteIds?: Set<string>;
    knownEvidenceIds?: Set<string>;
    knownBenchmarkCaseIds?: Set<string>;
    skillEvidence?: Map<string, string>;
    rewriteEvidence?: Map<string, { requirement: string; strategy: string }>;
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    normalizeCaseCorpusEntry(entry);
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'invalid_entry',
      entry_key: entry.case_id ?? 'unknown',
      knowledge_id: entry.knowledge_id ?? 'unknown',
      message: error instanceof Error ? error.message : String(error),
    });
    return issues;
  }

  if (context.knownBenchmarkCaseIds && !context.knownBenchmarkCaseIds.has(entry.benchmark_ref)) {
    issues.push({
      severity: 'error',
      code: 'invalid_benchmark_ref',
      entry_key: entry.case_id,
      knowledge_id: entry.knowledge_id,
      message: `benchmark_ref references unknown benchmark-v3 case_id: ${entry.benchmark_ref}`,
    });
  }

  if (isActiveCaseStatus(entry.case_status) && (entry.linkage.skills?.length ?? 0) === 0) {
    issues.push({
      severity: 'warn',
      code: 'missing_skill_linkage',
      entry_key: entry.case_id,
      knowledge_id: entry.knowledge_id,
      message: 'Active case should link to at least one skill for evaluation',
    });
  }

  if (
    requiresHumanVerificationForVerified(entry) &&
    verificationRank(entry.verification_status) < verificationRank('human_verified')
  ) {
    issues.push({
      severity: 'error',
      code: 'unverified_verified_case',
      entry_key: entry.case_id,
      knowledge_id: entry.knowledge_id,
      message: 'case_status verified requires verification_status >= human_verified',
    });
  }

  const needsEvidence =
    context.skillEvidence &&
    context.rewriteEvidence &&
    entryRequiresEvidenceValidation(entry, context.skillEvidence, context.rewriteEvidence);

  if (needsEvidence && !entry.ground_truth_spec.evidence_validation?.evidence_id) {
    issues.push({
      severity: 'error',
      code: 'missing_evidence_validation',
      entry_key: entry.case_id,
      knowledge_id: entry.knowledge_id,
      message: 'Evidence-dependent case must include ground_truth_spec.evidence_validation',
    });
  }

  if (entry.case_result.matched_skill && !(entry.linkage.skills ?? []).includes(entry.case_result.matched_skill)) {
    issues.push({
      severity: 'warn',
      code: 'case_result_skill_mismatch',
      entry_key: entry.case_id,
      knowledge_id: entry.knowledge_id,
      message: 'case_result.matched_skill should appear in linkage.skills',
    });
  }

  for (const regulationId of entry.linkage.regulations ?? []) {
    if (context.knownRegulationIds && !context.knownRegulationIds.has(regulationId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_regulation_link',
        entry_key: entry.case_id,
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
        entry_key: entry.case_id,
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
        entry_key: entry.case_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.skills references unknown skill: ${skillId}`,
      });
    }
  }

  for (const rewriteId of entry.linkage.rewrites ?? []) {
    if (context.knownRewriteIds && !context.knownRewriteIds.has(rewriteId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_rewrite_link',
        entry_key: entry.case_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.rewrites references unknown rewrite: ${rewriteId}`,
      });
    }
  }

  for (const evidenceId of entry.linkage.evidence ?? []) {
    if (context.knownEvidenceIds && !context.knownEvidenceIds.has(evidenceId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_evidence_link',
        entry_key: entry.case_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.evidence references unknown evidence: ${evidenceId}`,
      });
    }
  }

  const evidenceValidationId = entry.ground_truth_spec.evidence_validation?.evidence_id;
  if (evidenceValidationId && context.knownEvidenceIds && !context.knownEvidenceIds.has(evidenceValidationId)) {
    issues.push({
      severity: 'error',
      code: 'invalid_evidence_validation_ref',
      entry_key: entry.case_id,
      knowledge_id: entry.knowledge_id,
      message: `evidence_validation references unknown evidence: ${evidenceValidationId}`,
    });
  }

  return issues;
}

function validateCaseGovernance(entry: CaseCorpusEntry, context: { now: Date }): ValidationIssue[] {
  return validateSharedGovernance(entry, {
    getEntryKey: (item) => item.case_id,
    hasOutboundLinkage: hasCaseOutboundLinkage,
  }, context);
}

function buildCaseCoverage(entries: CaseCorpusEntry[], now: Date): CorpusCoverageReport {
  const taxonomy = loadCaseTaxonomy();
  const clusters = taxonomy.claim_clusters.map((item) => item.cluster_id);
  const benchmarkIds = loadBenchmarkCaseIds();

  const primary_coverage = clusters.map((clusterId) => {
    const matched = entries.filter((entry) => entry.scenario_spec.claim_cluster === clusterId);
    return {
      axis_id: clusterId,
      axis_label: clusterId,
      entry_count: matched.length,
      secondary_count: matched.filter((entry) => entry.case_status === 'verified').length,
      secondary_total: matched.length,
      coverage_pct: matched.length > 0 ? 100 : 0,
    };
  });

  const statusCounts = new Map<string, number>();
  for (const entry of entries) {
    statusCounts.set(entry.case_status, (statusCounts.get(entry.case_status) ?? 0) + 1);
  }

  const secondary_coverage = [...statusCounts.entries()].map(([status, count]) => ({
    axis_id: status,
    axis_label: status,
    entry_count: count,
    secondary_count: count,
    secondary_total: entries.length,
    coverage_pct: entries.length > 0 ? Math.round((count / entries.length) * 1000) / 10 : 0,
  }));

  const missing_primary = clusters.filter(
    (clusterId) => !entries.some((entry) => entry.scenario_spec.claim_cluster === clusterId),
  );

  const referencedBenchmarks = new Set(entries.map((entry) => entry.benchmark_ref));
  let linked = 0;
  for (const entry of entries) {
    if ((entry.linkage.skills?.length ?? 0) > 0) {
      linked += 1;
    }
  }

  const corpusSize = entries.length || 1;
  const withOwner = entries.filter((entry) => Boolean(entry.owner)).length;
  const withOwnerType = entries.filter((entry) => Boolean(entry.owner_type)).length;
  const approved = entries.filter((entry) => entry.review_status === 'legal_reviewed').length;

  return {
    generated_at: now.toISOString(),
    corpus_type: 'case',
    corpus_size: entries.length,
    primary_coverage,
    secondary_coverage,
    missing_primary,
    missing_secondary: [],
    knowledge_quality_score: scoreCorpusKqs(entries, caseKqsDimensions, (entry) => entry.case_id),
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
      external_targets_referenced: referencedBenchmarks.size,
      external_targets_total: benchmarkIds.size,
      external_target_coverage_pct: Math.round((referencedBenchmarks.size / benchmarkIds.size) * 1000) / 10,
    },
  };
}

function buildCaseManifest(entries: CaseCorpusEntry[], root: string, now: Date): CorpusManifest {
  const taxonomy = loadCaseTaxonomy(root);
  const kqs = scoreCorpusKqs(entries, caseKqsDimensions, (entry) => entry.case_id);
  const by_cluster: Record<string, number> = {};
  for (const cluster of taxonomy.claim_clusters) {
    by_cluster[cluster.cluster_id] = entries.filter(
      (entry) => entry.scenario_spec.claim_cluster === cluster.cluster_id,
    ).length;
  }
  const by_status: Record<string, number> = {};
  for (const entry of entries) {
    by_status[entry.case_status] = (by_status[entry.case_status] ?? 0) + 1;
  }

  return {
    schema_version: '1.0.0',
    platform_version: KNOWLEDGE_PLATFORM_VERSION,
    corpus_type: 'case',
    generated_at: now.toISOString(),
    corpus_root: root,
    fingerprint: fingerprintEntries(entries, (entry) =>
      `${entry.knowledge_id}|${entry.case_version}|${entry.last_reviewed}|${entry.case_status}|${entry.benchmark_ref}`,
    ),
    entry_count: entries.length,
    knowledge_quality_score: kqs.overall,
    freshness: computeFreshnessStats(entries, now),
    knowledge_ids: entries.map((entry) => entry.knowledge_id).sort(),
    dimensions: { by_cluster, by_status },
    manifest_filename: 'case-corpus.manifest.json',
    metadata: {
      claim_clusters: taxonomy.claim_clusters.map((item) => item.cluster_id),
    },
  };
}

export function validateBenchmarkCoverageGap(entries: CaseCorpusEntry[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pilotBenchmarkIds = new Set(entries.map((entry) => entry.benchmark_ref));
  const allBenchmarkIds = loadBenchmarkCaseIds();
  const covered = pilotBenchmarkIds.size;
  const total = allBenchmarkIds.size;
  if (covered < total) {
    issues.push({
      severity: 'warn',
      code: 'benchmark_coverage_gap',
      entry_key: 'corpus',
      knowledge_id: 'case:corpus',
      message: `Case Corpus covers ${covered}/${total} benchmark-v3 cases (${Math.round((covered / total) * 1000) / 10}%)`,
    });
  }
  return issues;
}

export const caseCorpusPlugin: KnowledgeCorpusPlugin<CaseCorpusEntry> = {
  corpus_type: 'case',
  platform_version: KNOWLEDGE_PLATFORM_VERSION,
  dashboardTitle: 'Case Corpus Dashboard',
  coverageTitle: 'Case Corpus Coverage Report',
  manifest_filename: 'case-corpus.manifest.json',
  load(customRoot?: string) {
    const corpus = loadCaseCorpus(customRoot);
    return { root: corpus.root, entries: corpus.entries };
  },
  getEntryKey: (entry) => entry.case_id,
  getLinkage: caseEntryLinkage,
  kqsDimensions: caseKqsDimensions,
  buildCoverage: buildCaseCoverage,
  buildManifest: buildCaseManifest,
  validate(entries, context) {
    const knownRegulationIds = loadKnownRegulationIds();
    const knownSkillIds = loadKnownSkillIds();
    const knownRewriteIds = loadKnownRewriteIds();
    const knownEvidenceIds = loadKnownEvidenceIds();
    const knownBenchmarkCaseIds = loadBenchmarkCaseIds();
    const skillEvidence = loadSkillEvidenceRequirement();
    const rewriteEvidence = loadRewriteEvidenceRequirement();

    const corpusResult = validateCorpus(entries, {
      corpus_type: 'case',
      getEntryKey: (entry) => entry.case_id,
      validateStructure: (entry, ctx) =>
        validateCaseStructure(entry, {
          knownRuleIds: ctx.knownRuleIds,
          knownRegulationIds,
          knownSkillIds,
          knownRewriteIds,
          knownEvidenceIds,
          knownBenchmarkCaseIds,
          skillEvidence,
          rewriteEvidence,
        }),
      validateGovernance: validateCaseGovernance,
      getDedupeKeys: (entry) => [{ code: 'duplicate_benchmark_ref', key: entry.benchmark_ref }],
    }, context);

    const gapIssues = validateBenchmarkCoverageGap(entries);
    const issues = [...corpusResult.issues, ...gapIssues];
    const error_count = issues.filter((issue) => issue.severity === 'error').length;
    const warn_count = issues.filter((issue) => issue.severity === 'warn').length;

    return {
      ...corpusResult,
      issues,
      governance_warnings: issues.filter((issue) => issue.severity === 'warn'),
      error_count,
      warn_count,
      passed: error_count === 0,
    };
  },
  knownRuleIds: loadDemoRuleIds,
  defaultReportsDir: () => join(repoRoot(), 'reports'),
  fingerprintEntry: (entry) =>
    `${entry.knowledge_id}|${entry.case_version}|${entry.last_reviewed}|${entry.case_status}|${entry.benchmark_ref}`,
};

export { caseKqsDimensions };
