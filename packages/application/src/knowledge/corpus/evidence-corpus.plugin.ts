import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isActiveEvidenceStatus,
  loadEvidenceCorpus,
  loadEvidenceTypes,
  normalizeEvidenceCorpusEntry,
  requiresDocumentRefSpec,
  requiresRegulationLinkage,
  resolveExpectedEvidenceType,
  type EvidenceCorpusEntry,
  type ResolvableExpectedEvidenceType,
} from '../evidence-corpus.js';
import { loadRegulationCorpusEntries } from '../regulation-corpus.js';
import { loadSkillCorpusEntries } from '../skill-corpus.js';
import { loadRewriteCorpusEntries } from '../rewrite-corpus.js';
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
import { hasEvidenceOutboundLinkage, evidenceEntryLinkage } from './evidence-entry.adapter.js';

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

function loadKnownRewriteIds(): Set<string> {
  return new Set(loadRewriteCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadKnownCaseIds(): Set<string> {
  return new Set(loadCaseCorpusEntries().map((entry) => entry.knowledge_id));
}

function loadBenchmarkCaseIds(): Set<string> {
  const benchmarkPath = join(repoRoot(), 'benchmark/benchmark-v3.json');
  const doc = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
    cases: Array<{ case_id: string }>;
  };
  return new Set(doc.cases.map((item) => item.case_id));
}

function buildSkillEvidenceIndex(): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const skill of loadSkillCorpusEntries()) {
    for (const evidenceId of skill.linkage.evidence ?? []) {
      const bucket = index.get(evidenceId) ?? new Set<string>();
      bucket.add(skill.knowledge_id);
      index.set(evidenceId, bucket);
    }
  }
  return index;
}

function scoreEvidencePurpose(entry: EvidenceCorpusEntry): number {
  const purpose = entry.evidence_purpose?.trim() ?? '';
  if (purpose.length >= 40) {
    return 1;
  }
  if (purpose.length >= 20) {
    return 0.6;
  }
  return 0;
}

function scoreValidationCriteria(entry: EvidenceCorpusEntry): number {
  const checks = entry.validation_criteria.checks.length;
  const rejectIf = entry.validation_criteria.reject_if?.length ?? 0;
  if (checks >= 3 && rejectIf >= 1) {
    return 1;
  }
  if (checks >= 2) {
    return 0.7;
  }
  return 0;
}

function scoreDocumentRefSpec(entry: EvidenceCorpusEntry): number {
  if (!requiresDocumentRefSpec(entry)) {
    return entry.document_ref_spec ? 0.8 : 0.6;
  }
  return entry.document_ref_spec?.ref_kind && entry.document_ref_spec?.id_format ? 1 : 0;
}

function scoreRegulationLinkage(entry: EvidenceCorpusEntry): number {
  if (entry.regulation_scope === 'independent') {
    return 1;
  }
  return (entry.linkage.regulations?.length ?? 0) > 0 ? 1 : 0;
}

function scoreRuleLinkage(entry: EvidenceCorpusEntry): number {
  return (entry.linkage.rules?.length ?? 0) > 0 ? 1 : 0.35;
}

function scorePurposeTags(entry: EvidenceCorpusEntry): number {
  return entry.evidence_purpose_tags.length > 0 ? 1 : 0;
}

function scoreApplicability(entry: EvidenceCorpusEntry): number {
  const applicability = entry.applicability;
  if ((applicability.countries?.length ?? 0) > 0 && (applicability.claim_types?.length ?? 0) > 0) {
    return 1;
  }
  return 0.35;
}

const evidenceKqsDimensions: KqsDimensionDef<EvidenceCorpusEntry>[] = [
  { id: 'evidence_purpose', label: 'Evidence purpose', score: scoreEvidencePurpose },
  { id: 'validation_criteria', label: 'Validation criteria', score: scoreValidationCriteria },
  { id: 'document_ref_spec', label: 'Document ref spec', score: scoreDocumentRefSpec },
  ...sharedClassificationDimensions<EvidenceCorpusEntry>(),
  { id: 'regulation_linkage', label: 'Regulation linkage', score: scoreRegulationLinkage },
  { id: 'rule_linkage', label: 'Rule linkage', score: scoreRuleLinkage },
  { id: 'purpose_tags', label: 'Purpose tags', score: scorePurposeTags },
  { id: 'applicability', label: 'Applicability', score: scoreApplicability },
];

function validateEvidenceStructure(
  entry: EvidenceCorpusEntry,
  context: {
    knownRuleIds?: Set<string>;
    knownRegulationIds?: Set<string>;
    knownSkillIds?: Set<string>;
    knownRewriteIds?: Set<string>;
    knownBenchmarkCaseIds?: Set<string>;
    knownCaseIds?: Set<string>;
    skillEvidenceIndex?: Map<string, Set<string>>;
    typesDoc?: ReturnType<typeof loadEvidenceTypes>;
    allEntries?: EvidenceCorpusEntry[];
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    normalizeEvidenceCorpusEntry(entry);
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'invalid_entry',
      entry_key: entry.evidence_id ?? 'unknown',
      knowledge_id: entry.knowledge_id ?? 'unknown',
      message: error instanceof Error ? error.message : String(error),
    });
    return issues;
  }

  if (requiresRegulationLinkage(entry) && (entry.linkage.regulations?.length ?? 0) === 0) {
    issues.push({
      severity: 'error',
      code: 'missing_regulation_linkage',
      entry_key: entry.evidence_id,
      knowledge_id: entry.knowledge_id,
      message:
        'Active evidence entry must link to at least one regulation knowledge_id (or declare regulation_scope: independent)',
    });
  }

  if (isActiveEvidenceStatus(entry.evidence_status) && (entry.linkage.rules?.length ?? 0) === 0) {
    issues.push({
      severity: 'warn',
      code: 'missing_rule_linkage',
      entry_key: entry.evidence_id,
      knowledge_id: entry.knowledge_id,
      message: 'Active evidence entry should link to at least one rule ID',
    });
  }

  if (requiresDocumentRefSpec(entry) && !entry.document_ref_spec?.ref_kind?.trim()) {
    issues.push({
      severity: 'error',
      code: 'missing_document_ref_spec',
      entry_key: entry.evidence_id,
      knowledge_id: entry.knowledge_id,
      message: `Document-backed evidence type ${entry.evidence_type_key} requires document_ref_spec`,
    });
  }

  if (
    !requiresDocumentRefSpec(entry) &&
    isActiveEvidenceStatus(entry.evidence_status) &&
    !entry.document_ref_spec
  ) {
    issues.push({
      severity: 'warn',
      code: 'recommended_document_ref_spec',
      entry_key: entry.evidence_id,
      knowledge_id: entry.knowledge_id,
      message: 'Consider adding document_ref_spec for substantiation traceability',
    });
  }

  for (const regulationId of entry.linkage.regulations ?? []) {
    if (context.knownRegulationIds && !context.knownRegulationIds.has(regulationId)) {
      issues.push({
        severity: 'error',
        code: 'invalid_regulation_link',
        entry_key: entry.evidence_id,
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
        entry_key: entry.evidence_id,
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
        entry_key: entry.evidence_id,
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
        entry_key: entry.evidence_id,
        knowledge_id: entry.knowledge_id,
        message: `linkage.rewrites references unknown rewrite: ${rewriteId}`,
      });
    }
  }

  for (const caseRef of entry.benchmark_refs ?? []) {
    if (context.knownBenchmarkCaseIds && !context.knownBenchmarkCaseIds.has(caseRef)) {
      issues.push({
        severity: 'error',
        code: 'invalid_benchmark_ref',
        entry_key: entry.evidence_id,
        knowledge_id: entry.knowledge_id,
        message: `benchmark_refs references unknown benchmark-v3 case_id: ${caseRef}`,
      });
    }
  }

  for (const caseRef of entry.case_refs ?? []) {
    if (!caseRef.startsWith('case:')) {
      issues.push({
        severity: 'error',
        code: 'invalid_case_ref',
        entry_key: entry.evidence_id,
        knowledge_id: entry.knowledge_id,
        message: `case_refs must use case: prefix: ${caseRef}`,
      });
      continue;
    }
    if (context.knownCaseIds && caseRef.length > 5 && !context.knownCaseIds.has(caseRef)) {
      issues.push({
        severity: 'warn',
        code: 'unknown_case_ref',
        entry_key: entry.evidence_id,
        knowledge_id: entry.knowledge_id,
        message: `case_refs references unknown Case Corpus entry: ${caseRef}`,
      });
    }
  }

  const skillRefs = context.skillEvidenceIndex?.get(entry.knowledge_id) ?? new Set<string>();
  for (const skillId of entry.linkage.skills ?? []) {
    if (!skillRefs.has(skillId)) {
      issues.push({
        severity: 'warn',
        code: 'asymmetric_skill_evidence_link',
        entry_key: entry.evidence_id,
        knowledge_id: entry.knowledge_id,
        message: `skill ${skillId} is linked from evidence but does not link back via linkage.evidence`,
      });
    }
  }

  if (context.typesDoc && context.allEntries) {
    for (const expectedType of entry.resolves_expected_evidence_types) {
      const resolution = context.typesDoc.expected_evidence_type_resolution.find(
        (item) => item.expected_evidence_type === expectedType,
      );
      if (!resolution) {
        continue;
      }
      const hasMatchingPurposeTag = entry.evidence_purpose_tags.some((tag) =>
        resolution.purpose_tags.includes(tag),
      );
      if (!hasMatchingPurposeTag) {
        issues.push({
          severity: 'warn',
          code: 'purpose_tag_resolution_gap',
          entry_key: entry.evidence_id,
          knowledge_id: entry.knowledge_id,
          message: `evidence_purpose_tags do not intersect resolution purpose_tags for ${expectedType}`,
        });
      }
    }
  }

  return issues;
}

function validateEvidenceGovernance(
  entry: EvidenceCorpusEntry,
  context: { now: Date },
): ValidationIssue[] {
  return validateSharedGovernance(entry, {
    getEntryKey: (item) => item.evidence_id,
    hasOutboundLinkage: hasEvidenceOutboundLinkage,
  }, context);
}

function buildEvidenceCoverage(entries: EvidenceCorpusEntry[], now: Date): CorpusCoverageReport {
  const types = loadEvidenceTypes();
  const typeKeys = types.evidence_type_keys.map((item) => item.type_key);
  const demoRuleIds = loadDemoRuleIds();

  const primary_coverage = typeKeys.map((typeKey) => {
    const matched = entries.filter((entry) => entry.evidence_type_key === typeKey);
    return {
      axis_id: typeKey,
      axis_label: typeKey,
      entry_count: matched.length,
      secondary_count: matched.filter((entry) => isActiveEvidenceStatus(entry.evidence_status)).length,
      secondary_total: matched.length,
      coverage_pct: matched.length > 0 ? 100 : 0,
    };
  });

  const statusCounts = new Map<string, number>();
  for (const entry of entries) {
    statusCounts.set(entry.evidence_status, (statusCounts.get(entry.evidence_status) ?? 0) + 1);
  }

  const secondary_coverage = [...statusCounts.entries()].map(([status, count]) => ({
    axis_id: status,
    axis_label: status,
    entry_count: count,
    secondary_count: count,
    secondary_total: entries.length,
    coverage_pct: entries.length > 0 ? Math.round((count / entries.length) * 1000) / 10 : 0,
  }));

  const missing_primary = typeKeys.filter(
    (typeKey) => !entries.some((entry) => entry.evidence_type_key === typeKey),
  );

  let linked = 0;
  const referencedExternal = new Set<string>();
  for (const entry of entries) {
    if ((entry.linkage.regulations?.length ?? 0) > 0) {
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
    corpus_type: 'evidence',
    corpus_size: entries.length,
    primary_coverage,
    secondary_coverage,
    missing_primary,
    missing_secondary: [],
    knowledge_quality_score: scoreCorpusKqs(entries, evidenceKqsDimensions, (entry) => entry.evidence_id),
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

function buildEvidenceManifest(
  entries: EvidenceCorpusEntry[],
  root: string,
  now: Date,
): CorpusManifest {
  const types = loadEvidenceTypes(root);
  const kqs = scoreCorpusKqs(entries, evidenceKqsDimensions, (entry) => entry.evidence_id);
  const by_type: Record<string, number> = {};
  for (const typeDef of types.evidence_type_keys) {
    by_type[typeDef.type_key] = entries.filter(
      (entry) => entry.evidence_type_key === typeDef.type_key,
    ).length;
  }
  const by_status: Record<string, number> = {};
  for (const entry of entries) {
    by_status[entry.evidence_status] = (by_status[entry.evidence_status] ?? 0) + 1;
  }

  return {
    schema_version: '1.0.0',
    platform_version: KNOWLEDGE_PLATFORM_VERSION,
    corpus_type: 'evidence',
    generated_at: now.toISOString(),
    corpus_root: root,
    fingerprint: fingerprintEntries(entries, (entry) =>
      `${entry.knowledge_id}|${entry.evidence_version}|${entry.last_reviewed}|${entry.evidence_status}|${entry.requirement_scope}`,
    ),
    entry_count: entries.length,
    knowledge_quality_score: kqs.overall,
    freshness: computeFreshnessStats(entries, now),
    knowledge_ids: entries.map((entry) => entry.knowledge_id).sort(),
    dimensions: { by_type, by_status },
    manifest_filename: 'evidence-corpus.manifest.json',
    metadata: {
      evidence_type_keys: types.evidence_type_keys.map((item) => item.type_key),
    },
  };
}

export function validateExpectedEvidenceTypeCoverage(
  entries: EvidenceCorpusEntry[],
  typesDoc: ReturnType<typeof loadEvidenceTypes>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rewrites = loadRewriteCorpusEntries();

  for (const rewrite of rewrites) {
    const expectedType = rewrite.expected_evidence_type;
    if (!expectedType || expectedType === 'none') {
      continue;
    }
    const resolved = resolveExpectedEvidenceType(
      expectedType as ResolvableExpectedEvidenceType,
      entries,
      typesDoc,
    );
    if (resolved.length === 0) {
      issues.push({
        severity: 'error',
        code: 'expected_evidence_type_unresolved',
        entry_key: rewrite.rewrite_id,
        knowledge_id: rewrite.knowledge_id,
        message: `Rewrite expected_evidence_type ${expectedType} does not resolve to any production evidence entry via purpose/type mapping`,
      });
    }
  }

  return issues;
}

export const evidenceCorpusPlugin: KnowledgeCorpusPlugin<EvidenceCorpusEntry> = {
  corpus_type: 'evidence',
  platform_version: KNOWLEDGE_PLATFORM_VERSION,
  dashboardTitle: 'Evidence Corpus Dashboard',
  coverageTitle: 'Evidence Corpus Coverage Report',
  manifest_filename: 'evidence-corpus.manifest.json',
  load(customRoot?: string) {
    const corpus = loadEvidenceCorpus(customRoot);
    return { root: corpus.root, entries: corpus.entries };
  },
  getEntryKey: (entry) => entry.evidence_id,
  getLinkage: evidenceEntryLinkage,
  kqsDimensions: evidenceKqsDimensions,
  buildCoverage: buildEvidenceCoverage,
  buildManifest: buildEvidenceManifest,
  validate(entries, context) {
    const knownRegulationIds = loadKnownRegulationIds();
    const knownSkillIds = loadKnownSkillIds();
    const knownRewriteIds = loadKnownRewriteIds();
    const knownBenchmarkCaseIds = loadBenchmarkCaseIds();
    const knownCaseIds = loadKnownCaseIds();
    const skillEvidenceIndex = buildSkillEvidenceIndex();
    const typesDoc = loadEvidenceTypes();
    const corpusResult = validateCorpus(entries, {
      corpus_type: 'evidence',
      getEntryKey: (entry) => entry.evidence_id,
      validateStructure: (entry, ctx) =>
        validateEvidenceStructure(entry, {
          knownRuleIds: ctx.knownRuleIds,
          knownRegulationIds,
          knownSkillIds,
          knownRewriteIds,
          knownBenchmarkCaseIds,
          knownCaseIds,
          skillEvidenceIndex,
          typesDoc,
          allEntries: entries,
        }),
      validateGovernance: validateEvidenceGovernance,
      getDedupeKeys: (entry) => [
        { code: 'duplicate_requirement_scope', key: `${entry.evidence_type_key}:${entry.requirement_scope}` },
      ],
    }, context);

    const coverageIssues = validateExpectedEvidenceTypeCoverage(entries, typesDoc);
    const issues = [...corpusResult.issues, ...coverageIssues];
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
    `${entry.knowledge_id}|${entry.evidence_version}|${entry.last_reviewed}|${entry.evidence_status}|${entry.requirement_scope}`,
};

export { evidenceKqsDimensions };
