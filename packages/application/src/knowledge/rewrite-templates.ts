import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RewriteStrategyType = 'qualify' | 'remove' | 'disclose' | 'cite_evidence';

export type RewriteExpectation = {
  strategy: RewriteStrategyType;
  must_remove_terms?: string[];
  must_include_concepts?: string[];
  template_id?: string;
};

export type RewriteMatchResult = {
  passed: boolean;
  score: number;
  failures: string[];
};

export type RewriteTemplate = {
  template_id: string;
  strategy: RewriteStrategyType;
  description: string;
  must_remove_terms?: string[];
  must_include_concepts?: string[];
};

export type RewriteTemplatesDocument = {
  schema_version: string;
  templates: RewriteTemplate[];
};

const defaultTemplatesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge/rewrite-templates.json',
);

export function loadRewriteTemplates(customPath?: string): RewriteTemplatesDocument {
  const path = customPath ?? defaultTemplatesPath;
  return JSON.parse(readFileSync(path, 'utf8')) as RewriteTemplatesDocument;
}

export function getRewriteTemplate(
  doc: RewriteTemplatesDocument,
  templateId: string,
): RewriteTemplate | undefined {
  return doc.templates.find((t) => t.template_id === templateId);
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function conceptMatches(text: string, concept: string): boolean {
  const normalized = normalizeText(text);
  const needle = normalizeText(concept);
  if (normalized.includes(needle)) {
    return true;
  }
  if (needle === 'valid' && normalized.includes('validity')) {
    return true;
  }
  if (needle === 'validity' && normalized.includes('valid')) {
    return true;
  }
  if (needle === 'disclaimer' && normalized.includes('disclaim')) {
    return true;
  }
  return false;
}

/**
 * Score playbook rewrite guidance against template expectations.
 * - must_include_concepts: checked on playbook guidance text
 * - must_remove_terms: checked on original ad text (confirms violative setup)
 */
export function matchPlaybookRewriteGuidance(
  originalAdText: string,
  guidanceText: string,
  expected: RewriteExpectation,
): RewriteMatchResult {
  const failures: string[] = [];
  let checks = 0;
  let passedChecks = 0;

  for (const concept of expected.must_include_concepts ?? []) {
    checks += 1;
    if (conceptMatches(guidanceText, concept)) {
      passedChecks += 1;
    } else {
      failures.push(`must_include_concepts: guidance missing "${concept}"`);
    }
  }

  const removeTerms = expected.must_remove_terms ?? [];
  if (removeTerms.length > 0) {
    checks += 1;
    if (removeTerms.some((term) => conceptMatches(originalAdText, term))) {
      passedChecks += 1;
    } else {
      failures.push(
        `must_remove_terms: original ad missing any expected violator (${removeTerms.join(', ')})`,
      );
    }
  }

  if (checks === 0) {
    return { passed: true, score: 1, failures: [] };
  }

  const score = passedChecks / checks;
  return {
    passed: failures.length === 0,
    score,
    failures,
  };
}

export function buildRewriteExpectation(input: {
  strategy: RewriteStrategyType;
  template?: RewriteTemplate;
  must_remove_terms?: string[];
  must_include_concepts?: string[];
}): RewriteExpectation {
  return {
    strategy: input.strategy,
    template_id: input.template?.template_id,
    must_remove_terms: [
      ...(input.must_remove_terms ?? []),
      ...(input.template?.must_remove_terms ?? []),
    ],
    must_include_concepts: [
      ...(input.must_include_concepts ?? []),
      ...(input.template?.must_include_concepts ?? []),
    ],
  };
}

export function matchRewriteExpectation(
  actualText: string,
  expected: RewriteExpectation,
): RewriteMatchResult {
  const failures: string[] = [];
  const normalized = normalizeText(actualText);
  let checks = 0;
  let passedChecks = 0;

  for (const term of expected.must_remove_terms ?? []) {
    checks += 1;
    if (normalized.includes(normalizeText(term))) {
      failures.push(`must_remove_terms: still contains "${term}"`);
    } else {
      passedChecks += 1;
    }
  }

  for (const concept of expected.must_include_concepts ?? []) {
    checks += 1;
    if (normalized.includes(normalizeText(concept))) {
      passedChecks += 1;
    } else {
      failures.push(`must_include_concepts: missing "${concept}"`);
    }
  }

  if (checks === 0) {
    return { passed: true, score: 1, failures: [] };
  }

  const score = passedChecks / checks;
  return {
    passed: failures.length === 0,
    score,
    failures,
  };
}
