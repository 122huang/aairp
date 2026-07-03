import { regulationCorpusPlugin } from './corpus/regulation-corpus.plugin.js';
import type { ValidationIssue, ValidationResult } from './platform/governance/validator.js';

export type RegulationValidationIssue = {
  severity: 'error' | 'warn';
  code: string;
  regulation_id: string;
  message: string;
};

export type RegulationValidationResult = {
  validated_at: string;
  entry_count: number;
  passed: boolean;
  error_count: number;
  warn_count: number;
  issues: RegulationValidationIssue[];
  governance_warnings: RegulationValidationIssue[];
};

function mapIssue(issue: ValidationIssue): RegulationValidationIssue {
  return {
    severity: issue.severity,
    code: issue.code,
    regulation_id: issue.entry_key,
    message: issue.message,
  };
}

function mapResult(result: ValidationResult): RegulationValidationResult {
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

export function validateRegulationCorpus(options?: {
  customRoot?: string;
  now?: Date;
}): RegulationValidationResult {
  const now = options?.now ?? new Date();
  const bundle = regulationCorpusPlugin.load(options?.customRoot);
  const result = regulationCorpusPlugin.validate(bundle.entries, {
    now,
    knownRuleIds: regulationCorpusPlugin.knownRuleIds?.(),
  });
  return mapResult(result);
}
