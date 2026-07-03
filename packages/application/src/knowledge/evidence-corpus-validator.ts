import { evidenceCorpusPlugin } from './corpus/evidence-corpus.plugin.js';
import type { ValidationIssue, ValidationResult } from './platform/governance/validator.js';

export type EvidenceValidationIssue = {
  severity: 'error' | 'warn';
  code: string;
  evidence_id: string;
  message: string;
};

export type EvidenceValidationResult = {
  validated_at: string;
  entry_count: number;
  passed: boolean;
  error_count: number;
  warn_count: number;
  issues: EvidenceValidationIssue[];
  governance_warnings: EvidenceValidationIssue[];
};

function mapIssue(issue: ValidationIssue): EvidenceValidationIssue {
  return {
    severity: issue.severity,
    code: issue.code,
    evidence_id: issue.entry_key,
    message: issue.message,
  };
}

function mapResult(result: ValidationResult): EvidenceValidationResult {
  return {
    validated_at: result.validated_at,
    entry_count: result.entry_count,
    passed: result.passed,
    error_count: result.error_count,
    warn_count: result.warn_count,
    issues: result.issues.map(mapIssue),
    governance_warnings: result.governance_warnings.map(mapIssue),
  };
}

export function validateEvidenceCorpus(options?: {
  customRoot?: string;
  now?: Date;
}): EvidenceValidationResult {
  const now = options?.now ?? new Date();
  const bundle = evidenceCorpusPlugin.load(options?.customRoot);
  const result = evidenceCorpusPlugin.validate(bundle.entries, {
    now,
    knownRuleIds: evidenceCorpusPlugin.knownRuleIds?.(),
  });
  return mapResult(result);
}
