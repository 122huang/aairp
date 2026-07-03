import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertKnowledgeIdMatches,
  type CorpusType,
  type KnowledgeCorpusEnvelope,
} from './knowledge-corpus.js';
import type { ConfidenceLevel, EvidenceRequirement } from './platform/knowledge-classification.js';

export type EvidenceCorpusStatus = 'draft' | 'validated' | 'production' | 'deprecated';

export const EVIDENCE_CORPUS_STATUSES: EvidenceCorpusStatus[] = [
  'draft',
  'validated',
  'production',
  'deprecated',
];

export const ACTIVE_EVIDENCE_STATUSES: EvidenceCorpusStatus[] = ['validated', 'production'];

export type EvidenceTypeKey =
  | 'certification'
  | 'lab_report'
  | 'clinical'
  | 'substantiation_general'
  | 'test_method'
  | 'patent';

export const EVIDENCE_TYPE_KEYS: EvidenceTypeKey[] = [
  'certification',
  'lab_report',
  'clinical',
  'substantiation_general',
  'test_method',
  'patent',
];

export const DOCUMENT_BACKED_EVIDENCE_TYPE_KEYS: EvidenceTypeKey[] = [
  'certification',
  'lab_report',
  'clinical',
  'patent',
];

export type ResolvableExpectedEvidenceType =
  | 'certification'
  | 'lab_report'
  | 'substantiation_general'
  | 'test_method';

export const RESOLVABLE_EXPECTED_EVIDENCE_TYPES: ResolvableExpectedEvidenceType[] = [
  'certification',
  'lab_report',
  'substantiation_general',
  'test_method',
];

export type EvidenceValidationCriteria = {
  checks: string[];
  reject_if?: string[];
  acceptable_issuers?: string[];
  scoring_notes?: string;
};

export type EvidenceApplicability = {
  countries?: string[];
  claim_types?: string[];
  categories?: string[];
  modalities?: string[];
};

export type DocumentRefSpec = {
  ref_kind: string;
  id_format: string;
  storage_system?: string;
  example?: string;
  notes?: string;
};

export type ValidityWindow = {
  typical_validity_months?: number;
  renewal_review_trigger?: string;
  notes?: string;
};

export type EvidenceCorpusLinkage = {
  regulations?: string[];
  rules?: string[];
  skills?: string[];
  rewrites?: string[];
  cases?: string[];
};

export type EvidenceCorpusEntry = KnowledgeCorpusEnvelope & {
  corpus_type: 'evidence';
  evidence_id: string;
  evidence_purpose: string;
  evidence_status: EvidenceCorpusStatus;
  evidence_version: string;
  evidence_type_key: EvidenceTypeKey;
  requirement_scope: string;
  summary: string;
  review_guidance: string;
  validation_criteria: EvidenceValidationCriteria;
  applicability: EvidenceApplicability;
  requirement_level: EvidenceRequirement;
  linkage: EvidenceCorpusLinkage;
  resolves_expected_evidence_types: ResolvableExpectedEvidenceType[];
  evidence_purpose_tags: string[];
  document_ref_spec?: DocumentRefSpec;
  validity_window?: ValidityWindow;
  regulation_scope?: 'independent';
  regulation_independence_rationale?: string;
  benchmark_refs?: string[];
  case_refs?: string[];
  confidence_level?: ConfidenceLevel;
};

export type EvidenceTypeDef = {
  type_key: EvidenceTypeKey;
  name: string;
  description: string;
};

export type ExpectedEvidenceTypeResolution = {
  expected_evidence_type: ResolvableExpectedEvidenceType;
  evidence_type_keys: EvidenceTypeKey[];
  purpose_tags: string[];
};

export type EvidenceTypesDocument = {
  schema_version: string;
  description: string;
  evidence_type_keys: EvidenceTypeDef[];
  document_backed_type_keys: EvidenceTypeKey[];
  expected_evidence_type_resolution: ExpectedEvidenceTypeResolution[];
};

export type EvidenceCorpusLoadResult = {
  root: string;
  types: EvidenceTypesDocument;
  entries: EvidenceCorpusEntry[];
};

const defaultCorpusRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge/evidence-corpus',
);

export function resolveEvidenceCorpusRoot(customRoot?: string): string {
  if (customRoot) {
    return customRoot;
  }
  if (process.env.AAIRP_EVIDENCE_CORPUS_PATH) {
    return process.env.AAIRP_EVIDENCE_CORPUS_PATH;
  }
  return defaultCorpusRoot;
}

export function loadEvidenceTypes(customRoot?: string): EvidenceTypesDocument {
  const root = resolveEvidenceCorpusRoot(customRoot);
  return JSON.parse(readFileSync(join(root, 'evidence-types.json'), 'utf8')) as EvidenceTypesDocument;
}

export function isActiveEvidenceStatus(status: EvidenceCorpusStatus): boolean {
  return ACTIVE_EVIDENCE_STATUSES.includes(status);
}

export function requiresRegulationLinkage(entry: EvidenceCorpusEntry): boolean {
  if (entry.evidence_status === 'deprecated') {
    return false;
  }
  if (entry.regulation_scope === 'independent') {
    return false;
  }
  return isActiveEvidenceStatus(entry.evidence_status);
}

export function requiresDocumentRefSpec(entry: EvidenceCorpusEntry): boolean {
  return DOCUMENT_BACKED_EVIDENCE_TYPE_KEYS.includes(entry.evidence_type_key);
}

export function normalizeEvidenceCorpusEntry(raw: EvidenceCorpusEntry): EvidenceCorpusEntry {
  assertKnowledgeIdMatches(raw.knowledge_id, 'evidence', raw.evidence_id);
  if (raw.corpus_type !== 'evidence') {
    throw new Error(`expected corpus_type evidence, got ${raw.corpus_type}`);
  }
  if (!EVIDENCE_CORPUS_STATUSES.includes(raw.evidence_status)) {
    throw new Error(`unsupported evidence_status: ${raw.evidence_status}`);
  }
  if (!EVIDENCE_TYPE_KEYS.includes(raw.evidence_type_key)) {
    throw new Error(`unsupported evidence_type_key: ${raw.evidence_type_key}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(raw.evidence_version)) {
    throw new Error(`invalid evidence_version semver: ${raw.evidence_version}`);
  }
  if (raw.validation_criteria.checks.length < 2) {
    throw new Error(`evidence ${raw.evidence_id} must have at least two validation_criteria.checks`);
  }
  if (raw.resolves_expected_evidence_types.length === 0) {
    throw new Error(`evidence ${raw.evidence_id} must declare resolves_expected_evidence_types`);
  }
  if (raw.evidence_purpose_tags.length === 0) {
    throw new Error(`evidence ${raw.evidence_id} must declare evidence_purpose_tags`);
  }
  for (const expectedType of raw.resolves_expected_evidence_types) {
    if (!RESOLVABLE_EXPECTED_EVIDENCE_TYPES.includes(expectedType)) {
      throw new Error(`unsupported resolves_expected_evidence_type: ${expectedType}`);
    }
  }
  if (raw.regulation_scope === 'independent' && !raw.regulation_independence_rationale?.trim()) {
    throw new Error(
      `evidence ${raw.evidence_id} with regulation_scope independent requires regulation_independence_rationale`,
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
  for (const rewriteId of raw.linkage.rewrites ?? []) {
    if (!rewriteId.startsWith('rewrite:')) {
      throw new Error(`linkage.rewrites must use rewrite: prefix: ${rewriteId}`);
    }
  }
  for (const caseRef of raw.case_refs ?? []) {
    if (!caseRef.startsWith('case:')) {
      throw new Error(`case_refs must use case: prefix: ${caseRef}`);
    }
  }
  if (requiresDocumentRefSpec(raw) && !raw.document_ref_spec?.ref_kind?.trim()) {
    throw new Error(
      `evidence ${raw.evidence_id} with document-backed type ${raw.evidence_type_key} requires document_ref_spec`,
    );
  }
  return raw;
}

export function loadEvidenceCorpusEntry(filePath: string): EvidenceCorpusEntry {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as EvidenceCorpusEntry;
  return normalizeEvidenceCorpusEntry(raw);
}

function listEvidenceJsonFiles(evidenceDir: string): string[] {
  if (!existsSync(evidenceDir)) {
    return [];
  }
  return readdirSync(evidenceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(evidenceDir, entry.name));
}

export function loadEvidenceCorpusEntries(customRoot?: string): EvidenceCorpusEntry[] {
  const root = resolveEvidenceCorpusRoot(customRoot);
  const evidenceDir = join(root, 'evidence');
  const entries: EvidenceCorpusEntry[] = [];

  for (const filePath of listEvidenceJsonFiles(evidenceDir)) {
    entries.push(loadEvidenceCorpusEntry(filePath));
  }

  return entries.sort((a, b) => a.evidence_id.localeCompare(b.evidence_id));
}

export function loadEvidenceCorpus(customRoot?: string): EvidenceCorpusLoadResult {
  const root = resolveEvidenceCorpusRoot(customRoot);
  return {
    root,
    types: loadEvidenceTypes(root),
    entries: loadEvidenceCorpusEntries(root),
  };
}

export function isEvidenceCorpusType(corpusType: CorpusType): corpusType is 'evidence' {
  return corpusType === 'evidence';
}

export function evidenceKnowledgeId(evidenceId: string): string {
  return `evidence:${evidenceId}`;
}

export function resolveExpectedEvidenceType(
  expectedType: ResolvableExpectedEvidenceType,
  entries: EvidenceCorpusEntry[],
  typesDoc: EvidenceTypesDocument,
): EvidenceCorpusEntry[] {
  const resolution = typesDoc.expected_evidence_type_resolution.find(
    (item) => item.expected_evidence_type === expectedType,
  );
  if (!resolution) {
    return [];
  }
  return entries.filter(
    (entry) =>
      isActiveEvidenceStatus(entry.evidence_status) &&
      entry.resolves_expected_evidence_types.includes(expectedType) &&
      entry.evidence_purpose_tags.some((tag) => resolution.purpose_tags.includes(tag)),
  );
}
