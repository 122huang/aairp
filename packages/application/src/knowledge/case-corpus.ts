import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertKnowledgeIdMatches,
  type CorpusType,
  type KnowledgeCorpusEnvelope,
} from './knowledge-corpus.js';
import type { ConfidenceLevel } from './platform/knowledge-classification.js';

export type CaseCorpusStatus = 'draft' | 'candidate' | 'verified' | 'regression' | 'deprecated';

export const CASE_CORPUS_STATUSES: CaseCorpusStatus[] = [
  'draft',
  'candidate',
  'verified',
  'regression',
  'deprecated',
];

export const ACTIVE_CASE_STATUSES: CaseCorpusStatus[] = ['candidate', 'verified', 'regression'];

export type CaseVerificationStatus =
  | 'unverified'
  | 'human_verified'
  | 'legal_verified'
  | 'rejected';

export const CASE_VERIFICATION_STATUSES: CaseVerificationStatus[] = [
  'unverified',
  'human_verified',
  'legal_verified',
  'rejected',
];

export const VERIFICATION_STATUS_RANK: Record<CaseVerificationStatus, number> = {
  rejected: -1,
  unverified: 0,
  human_verified: 1,
  legal_verified: 2,
};

export type CaseScenarioSpec = {
  claim_cluster?: string;
  claim_types?: string[];
  countries?: string[];
  categories?: string[];
  modalities?: string[];
  risk_class?: string;
  signal_summary?: string;
  benchmark_ref?: string;
};

export type CaseGroundTruthRewrite = {
  rewrite_id?: string;
  strategy_type?: string;
  must_remove_terms?: string[];
  must_include_concepts?: string[];
};

export type CaseEvidenceValidation = {
  evidence_id?: string;
  expected_outcome?: string;
};

export type CaseGroundTruthSpec = {
  expected_decision?: string;
  expected_severity?: string;
  expected_action?: string;
  expected_pattern?: string;
  expected_rule?: string;
  expected_rewrite?: CaseGroundTruthRewrite;
  evidence_validation?: CaseEvidenceValidation;
};

export type CaseResult = {
  decision_outcome?: string;
  risk_level?: string;
  matched_skill?: string;
  applied_rewrite?: string;
  evidence_result?: string;
};

export type CaseCorpusLinkage = {
  regulations?: string[];
  rules?: string[];
  skills?: string[];
  evidence?: string[];
  rewrites?: string[];
};

export type CaseCorpusEntry = KnowledgeCorpusEnvelope & {
  corpus_type: 'case';
  case_id: string;
  case_purpose: string;
  case_status: CaseCorpusStatus;
  case_version: string;
  verification_status: CaseVerificationStatus;
  summary: string;
  review_guidance: string;
  scenario_spec: CaseScenarioSpec;
  ground_truth_spec: CaseGroundTruthSpec;
  case_result: CaseResult;
  benchmark_ref: string;
  linkage: CaseCorpusLinkage;
  source_case_id?: string;
  source_metadata?: Record<string, string>;
  promotion_rationale?: string;
  promoted_from?: string;
  promoted_at?: string;
  promoted_by?: string;
  regression_notes?: string;
  confidence_level?: ConfidenceLevel;
};

export type CaseTaxonomyDocument = {
  schema_version: string;
  description: string;
  claim_clusters: Array<{ cluster_id: string; name: string }>;
  verification_statuses: Array<{ status: CaseVerificationStatus; rank: number; description: string }>;
  case_statuses: Array<{ status: CaseCorpusStatus; description: string }>;
  source_locator_convention?: Record<string, unknown>;
};

export type CaseCorpusLoadResult = {
  root: string;
  taxonomy: CaseTaxonomyDocument;
  entries: CaseCorpusEntry[];
};

const defaultCorpusRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge/case-corpus',
);

export function resolveCaseCorpusRoot(customRoot?: string): string {
  if (customRoot) {
    return customRoot;
  }
  if (process.env.AAIRP_CASE_CORPUS_PATH) {
    return process.env.AAIRP_CASE_CORPUS_PATH;
  }
  return defaultCorpusRoot;
}

export function loadCaseTaxonomy(customRoot?: string): CaseTaxonomyDocument {
  const root = resolveCaseCorpusRoot(customRoot);
  return JSON.parse(readFileSync(join(root, 'case-taxonomy.json'), 'utf8')) as CaseTaxonomyDocument;
}

export function isActiveCaseStatus(status: CaseCorpusStatus): boolean {
  return ACTIVE_CASE_STATUSES.includes(status);
}

export function verificationRank(status: CaseVerificationStatus): number {
  return VERIFICATION_STATUS_RANK[status];
}

export function requiresHumanVerificationForVerified(entry: CaseCorpusEntry): boolean {
  return entry.case_status === 'verified';
}

export function normalizeCaseCorpusEntry(raw: CaseCorpusEntry): CaseCorpusEntry {
  assertKnowledgeIdMatches(raw.knowledge_id, 'case', raw.case_id);
  if (raw.corpus_type !== 'case') {
    throw new Error(`expected corpus_type case, got ${raw.corpus_type}`);
  }
  if (!CASE_CORPUS_STATUSES.includes(raw.case_status)) {
    throw new Error(`unsupported case_status: ${raw.case_status}`);
  }
  if (!CASE_VERIFICATION_STATUSES.includes(raw.verification_status)) {
    throw new Error(`unsupported verification_status: ${raw.verification_status}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(raw.case_version)) {
    throw new Error(`invalid case_version semver: ${raw.case_version}`);
  }
  if (!raw.benchmark_ref?.trim()) {
    throw new Error(`case ${raw.case_id} must declare benchmark_ref`);
  }
  if (!raw.ground_truth_spec?.expected_decision) {
    throw new Error(`case ${raw.case_id} must declare ground_truth_spec.expected_decision`);
  }
  if (!raw.case_result?.decision_outcome) {
    throw new Error(`case ${raw.case_id} must declare case_result.decision_outcome`);
  }
  if (
    requiresHumanVerificationForVerified(raw) &&
    verificationRank(raw.verification_status) < verificationRank('human_verified')
  ) {
    throw new Error(
      `case ${raw.case_id} with case_status verified requires verification_status >= human_verified`,
    );
  }
  for (const regulationId of raw.linkage.regulations ?? []) {
    if (!regulationId.startsWith('regulation:')) {
      throw new Error(`linkage.regulations must use regulation: prefix: ${regulationId}`);
    }
  }
  for (const skillId of raw.linkage.skills ?? []) {
    if (!skillId.startsWith('skill:')) {
      throw new Error(`linkage.skills must use skill: prefix: ${skillId}`);
    }
  }
  for (const evidenceId of raw.linkage.evidence ?? []) {
    if (!evidenceId.startsWith('evidence:')) {
      throw new Error(`linkage.evidence must use evidence: prefix: ${evidenceId}`);
    }
  }
  for (const rewriteId of raw.linkage.rewrites ?? []) {
    if (!rewriteId.startsWith('rewrite:')) {
      throw new Error(`linkage.rewrites must use rewrite: prefix: ${rewriteId}`);
    }
  }
  return raw;
}

export function loadCaseCorpusEntry(filePath: string): CaseCorpusEntry {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as CaseCorpusEntry;
  return normalizeCaseCorpusEntry(raw);
}

function listCaseJsonFiles(casesDir: string): string[] {
  if (!existsSync(casesDir)) {
    return [];
  }
  return readdirSync(casesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(casesDir, entry.name));
}

export function loadCaseCorpusEntries(customRoot?: string): CaseCorpusEntry[] {
  const root = resolveCaseCorpusRoot(customRoot);
  const casesDir = join(root, 'cases');
  const entries: CaseCorpusEntry[] = [];
  for (const filePath of listCaseJsonFiles(casesDir)) {
    entries.push(loadCaseCorpusEntry(filePath));
  }
  return entries.sort((a, b) => a.case_id.localeCompare(b.case_id));
}

export function loadCaseCorpus(customRoot?: string): CaseCorpusLoadResult {
  const root = resolveCaseCorpusRoot(customRoot);
  return {
    root,
    taxonomy: loadCaseTaxonomy(root),
    entries: loadCaseCorpusEntries(root),
  };
}

export function isCaseCorpusType(corpusType: CorpusType): corpusType is 'case' {
  return corpusType === 'case';
}

export function caseKnowledgeId(caseId: string): string {
  return `case:${caseId}`;
}
