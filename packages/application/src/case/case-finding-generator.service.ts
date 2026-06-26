import { randomUUID } from 'node:crypto';
import type {
  CaseFinding,
  CasePrecedent,
  CaseRetrievalResult,
  CaseReviewContext,
  RuleEvaluationResult,
} from '@aairp/shared-kernel';

export type CaseFindingGeneratorConfig = {
  now?: () => Date;
  createFindingId?: () => string;
  minConfirmedSimilarity?: number;
};

const DEFAULT_MIN_CONFIRMED_SIMILARITY = 0.75;

function mapPrecedentDecision(
  finalDecision: CasePrecedent['final_decision'],
): CaseFinding['decision'] {
  if (finalDecision === 'PASS') {
    return 'PASS';
  }
  return 'WARN';
}

function mapPrecedentSeverity(
  finalDecision: CasePrecedent['final_decision'],
  similarityScore: number,
): CaseFinding['severity'] {
  if (finalDecision === 'REJECT' && similarityScore >= 0.9) {
    return 'MEDIUM';
  }
  if (finalDecision === 'WARN') {
    return 'MEDIUM';
  }
  return 'LOW';
}

function buildSummary(precedents: CasePrecedent[]): string {
  const decision = precedents[0]!.final_decision;
  if (precedents.length === 1) {
    const precedent = precedents[0]!;
    return `CONFIRMED precedent ${precedent.case_id} reached ${decision}`;
  }
  return `${precedents.length} similar CONFIRMED cases were ${decision}`;
}

export class CaseFindingGeneratorService {
  constructor(private readonly config: CaseFindingGeneratorConfig = {}) {}

  generate(
    retrieval: CaseRetrievalResult,
    ruleResult: RuleEvaluationResult,
    caseReviewContext?: CaseReviewContext,
  ): CaseFinding[] {
    const minSimilarity = this.config.minConfirmedSimilarity ?? DEFAULT_MIN_CONFIRMED_SIMILARITY;
    const confirmed = retrieval.precedents.filter(
      (precedent) =>
        precedent.lifecycle_status === 'CONFIRMED' &&
        precedent.similarity_score >= minSimilarity &&
        precedent.final_decision !== 'PASS',
    );

    if (confirmed.length === 0) {
      return [];
    }

    const currentRuleRefIds = new Set(ruleResult.findings.map((finding) => finding.refId));
    const sharedRuleOverlap =
      caseReviewContext?.sharedRuleRefs.filter((refId) => currentRuleRefIds.has(refId)) ?? [];
    const grouped = new Map<string, CasePrecedent[]>();

    for (const precedent of confirmed) {
      const key = precedent.final_decision;
      const bucket = grouped.get(key) ?? [];
      bucket.push(precedent);
      grouped.set(key, bucket);
    }

    const findings: CaseFinding[] = [];
    for (const precedents of grouped.values()) {
      const top = precedents.reduce((best, current) =>
        current.similarity_score > best.similarity_score ? current : best,
      );
      const ruleOverlap = sharedRuleOverlap.length > 0 ? sharedRuleOverlap : undefined;
      const confidence = Math.min(0.95, 0.6 + top.similarity_score * 0.3);

      findings.push({
        module: 'CASE',
        findingId: `cf_${(this.config.createFindingId ?? randomUUID)()}`,
        severity: mapPrecedentSeverity(top.final_decision, top.similarity_score),
        decision: mapPrecedentDecision(top.final_decision),
        refType: 'CASE_PRECEDENT',
        refId: top.case_id,
        refVersionId: `${top.case_id}-v${top.case_version}`,
        summary: buildSummary(precedents),
        confidence,
        evaluationDetail: {
          similarityScore: top.similarity_score,
          precedentFinalDecision: top.final_decision,
          lifecycleStatus: top.lifecycle_status,
          precedentCaseIds: precedents.map((precedent) => precedent.case_id),
          ...(ruleOverlap ? { ruleOverlap } : {}),
        },
      });
    }

    return findings;
  }
}
