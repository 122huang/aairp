import { rewriteCorpusPlugin } from './corpus/rewrite-corpus.plugin.js';
import type { ValidationIssue, ValidationResult } from './platform/governance/validator.js';

export type RewriteValidationIssue = {
  severity: 'error' | 'warn';
  code: string;
  rewrite_id: string;
  message: string;
};

export type RewriteValidationResult = {
  validated_at: string;
  entry_count: number;
  passed: boolean;
  error_count: number;
  warn_count: number;
  issues: RewriteValidationIssue[];
  governance_warnings: RewriteValidationIssue[];
};

function mapIssue(issue: ValidationIssue): RewriteValidationIssue {
  return {
    severity: issue.severity,
    code: issue.code,
    rewrite_id: issue.entry_key,
    message: issue.message,
  };
}

function mapResult(result: ValidationResult): RewriteValidationResult {
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

export function validateRewriteCorpus(options?: {
  customRoot?: string;
  now?: Date;
}): RewriteValidationResult {
  const now = options?.now ?? new Date();
  const bundle = rewriteCorpusPlugin.load(options?.customRoot);
  const result = rewriteCorpusPlugin.validate(bundle.entries, {
    now,
    knownRuleIds: rewriteCorpusPlugin.knownRuleIds?.(),
  });
  return mapResult(result);
}
