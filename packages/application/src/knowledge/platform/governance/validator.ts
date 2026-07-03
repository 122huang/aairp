import type { KnowledgeEntryBase } from '../knowledge-entry.js';
import type { KnowledgeLinkageTarget } from '../knowledge-linkage.js';
import {
  hasConfidenceClassification,
  hasEvidenceClassification,
} from '../knowledge-classification.js';
import { isStaleKnowledge } from './freshness.js';

export type ValidationSeverity = 'error' | 'warn';

export type ValidationIssue = {
  severity: ValidationSeverity;
  code: string;
  entry_key: string;
  knowledge_id: string;
  message: string;
};

export type ValidationResult = {
  validated_at: string;
  corpus_type: string;
  entry_count: number;
  passed: boolean;
  error_count: number;
  warn_count: number;
  issues: ValidationIssue[];
  governance_warnings: ValidationIssue[];
};

export type ValidationContext = {
  now: Date;
  knownRuleIds?: Set<string>;
};

export type CorpusValidatorHooks<T extends KnowledgeEntryBase> = {
  corpus_type: string;
  getEntryKey: (entry: T) => string;
  validateStructure: (entry: T, context: ValidationContext) => ValidationIssue[];
  validateGovernance: (entry: T, context: ValidationContext) => ValidationIssue[];
  getDedupeKeys?: (entry: T) => Array<{ code: string; key: string }>;
};

export function validateSharedGovernance<T extends KnowledgeEntryBase>(
  entry: T,
  hooks: {
    getEntryKey: (entry: T) => string;
    orphanLinkageTargets?: KnowledgeLinkageTarget[];
    hasOutboundLinkage: (entry: T) => boolean;
  },
  context: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entryKey = hooks.getEntryKey(entry);

  if (!entry.review_guidance?.trim()) {
    issues.push({
      severity: 'warn',
      code: 'missing_review_guidance',
      entry_key: entryKey,
      knowledge_id: entry.knowledge_id,
      message: 'review_guidance is missing or empty',
    });
  }

  if (!hasConfidenceClassification(entry)) {
    issues.push({
      severity: 'warn',
      code: 'missing_confidence',
      entry_key: entryKey,
      knowledge_id: entry.knowledge_id,
      message: 'Missing confidence classification (field or confidence:* tag)',
    });
  }

  if (!hasEvidenceClassification(entry)) {
    issues.push({
      severity: 'warn',
      code: 'missing_evidence_classification',
      entry_key: entryKey,
      knowledge_id: entry.knowledge_id,
      message: 'Missing evidence classification (field or evidence:* tag)',
    });
  }

  if (isStaleKnowledge(entry.last_reviewed, context.now)) {
    issues.push({
      severity: 'warn',
      code: 'stale_knowledge',
      entry_key: entryKey,
      knowledge_id: entry.knowledge_id,
      message: 'last_reviewed is older than 365 days (red freshness band)',
    });
  }

  if (!hooks.hasOutboundLinkage(entry)) {
    issues.push({
      severity: 'warn',
      code: 'orphan_entry',
      entry_key: entryKey,
      knowledge_id: entry.knowledge_id,
      message: 'No outbound knowledge linkage',
    });
  }

  return issues;
}

export function validateCorpus<T extends KnowledgeEntryBase>(
  entries: T[],
  hooks: CorpusValidatorHooks<T>,
  context?: Partial<ValidationContext>,
): ValidationResult {
  const now = context?.now ?? new Date();
  const validationContext: ValidationContext = { now, knownRuleIds: context?.knownRuleIds };
  const issues: ValidationIssue[] = [];

  const knowledgeIds = new Map<string, string>();
  const entryKeys = new Map<string, string>();
  const dedupeBuckets = new Map<string, Map<string, string[]>>();

  for (const entry of entries) {
    const entryKey = hooks.getEntryKey(entry);
    issues.push(...hooks.validateStructure(entry, validationContext));
    issues.push(...hooks.validateGovernance(entry, validationContext));

    if (knowledgeIds.has(entry.knowledge_id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_knowledge_id',
        entry_key: entryKey,
        knowledge_id: entry.knowledge_id,
        message: `Duplicate knowledge_id ${entry.knowledge_id} (also used by ${knowledgeIds.get(entry.knowledge_id)})`,
      });
    } else {
      knowledgeIds.set(entry.knowledge_id, entryKey);
    }

    if (entryKeys.has(entryKey)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_entry_key',
        entry_key: entryKey,
        knowledge_id: entry.knowledge_id,
        message: `Duplicate entry key ${entryKey}`,
      });
    } else {
      entryKeys.set(entryKey, entry.knowledge_id);
    }

    for (const dedupe of hooks.getDedupeKeys?.(entry) ?? []) {
      const bucket = dedupeBuckets.get(dedupe.code) ?? new Map<string, string[]>();
      const normalized = dedupe.key.trim().toLowerCase();
      const existing = bucket.get(normalized) ?? [];
      existing.push(entryKey);
      bucket.set(normalized, existing);
      dedupeBuckets.set(dedupe.code, bucket);
    }
  }

  for (const [code, bucket] of dedupeBuckets.entries()) {
    for (const [key, keys] of bucket.entries()) {
      if (keys.length > 1) {
        for (const entryKey of keys) {
          issues.push({
            severity: 'warn',
            code,
            entry_key: entryKey,
            knowledge_id: knowledgeIds.get(
              entries.find((entry) => hooks.getEntryKey(entry) === entryKey)?.knowledge_id ?? '',
            ) ?? entryKey,
            message: `Duplicate ${code} shared with: ${keys.filter((item) => item !== entryKey).join(', ')} (${key})`,
          });
        }
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warn');

  return {
    validated_at: now.toISOString(),
    corpus_type: hooks.corpus_type,
    entry_count: entries.length,
    passed: errors.length === 0,
    error_count: errors.length,
    warn_count: warnings.length,
    issues,
    governance_warnings: warnings,
  };
}
