import { caseCorpusPlugin } from './corpus/case-corpus.plugin.js';
import type { ValidationIssue, ValidationResult } from './platform/governance/validator.js';

export type CaseValidationIssue = {
  severity: 'error' | 'warn';
  code: string;
  case_id: string;
  message: string;
};

export type CaseValidationResult = {
  validated_at: string;
  entry_count: number;
  passed: boolean;
  error_count: number;
  warn_count: number;
  issues: CaseValidationIssue[];
  governance_warnings: CaseValidationIssue[];
};

function mapIssue(issue: ValidationIssue): CaseValidationIssue {
  return {
    severity: issue.severity,
    code: issue.code,
    case_id: issue.entry_key,
    message: issue.message,
  };
}

function mapResult(result: ValidationResult): CaseValidationResult {
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

export function validateCaseCorpus(options?: {
  customRoot?: string;
  now?: Date;
}): CaseValidationResult {
  const now = options?.now ?? new Date();
  const bundle = caseCorpusPlugin.load(options?.customRoot);
  const result = caseCorpusPlugin.validate(bundle.entries, {
    now,
    knownRuleIds: caseCorpusPlugin.knownRuleIds?.(),
  });
  return mapResult(result);
}
