import type { CaseRegulationRef } from './case-record.js';

export type CaseRegulationCitation = {
  law_name: string;
  article?: string;
  jurisdiction: string;
};

export type CaseReviewContext = {
  caseIds: string[];
  precedentSummaries: string[];
  sharedRuleRefs: string[];
  regulationCitations: CaseRegulationCitation[];
  humanOverrideNotes: string[];
  coverageScore: number;
  exactContentHashMatch: boolean;
  hasConfirmedExactMatch: boolean;
  coldStart: boolean;
};

export function formatCasePrecedentsForPrompt(context?: CaseReviewContext): string {
  if (!context || context.coldStart) {
    return 'none';
  }
  const lines = [...context.precedentSummaries];
  if (context.humanOverrideNotes.length > 0) {
    lines.push('Human override notes (do not blindly follow disputed outcomes):');
    lines.push(...context.humanOverrideNotes.map((note) => `- ${note}`));
  }
  return lines.join('\n');
}

export function formatRegulationRefsForPrompt(context?: CaseReviewContext): string {
  if (!context || context.regulationCitations.length === 0) {
    return 'none';
  }
  return context.regulationCitations
    .map((ref) => {
      const article = ref.article ? ` ${ref.article}` : '';
      return `${ref.law_name}${article} (${ref.jurisdiction})`;
    })
    .join('; ');
}

export function dedupeRegulationCitations(
  citations: CaseRegulationCitation[],
): CaseRegulationCitation[] {
  const seen = new Set<string>();
  const deduped: CaseRegulationCitation[] = [];
  for (const citation of citations) {
    const key = `${citation.law_name}|${citation.article ?? ''}|${citation.jurisdiction}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(citation);
  }
  return deduped;
}

export function mapCaseRegulationRef(ref: CaseRegulationRef): CaseRegulationCitation {
  return {
    law_name: ref.law_name,
    article: ref.article,
    jurisdiction: ref.jurisdiction,
  };
}
