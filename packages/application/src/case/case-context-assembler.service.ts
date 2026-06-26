import type {
  CaseRegulationCitation,
  CaseRetrievalResult,
  CaseReviewContext,
  ICaseStore,
  RuleEvaluationResult,
} from '@aairp/shared-kernel';
import {
  dedupeRegulationCitations,
  mapCaseRegulationRef,
} from '@aairp/shared-kernel';

export class CaseContextAssembler {
  constructor(private readonly caseStore: ICaseStore) {}

  async assemble(
    retrieval: CaseRetrievalResult,
    ruleResult: RuleEvaluationResult,
  ): Promise<CaseReviewContext> {
    const precedentSummaries: string[] = [];
    const regulationCitations: CaseRegulationCitation[] = [];
    const humanOverrideNotes: string[] = [];
    const sharedRuleRefs = new Set<string>();
    const currentRuleRefIds = new Set(ruleResult.findings.map((finding) => finding.refId));

    for (const precedent of retrieval.precedents) {
      const record = await this.caseStore.findByCaseId(precedent.case_id);
      const matchedRuleRefs =
        record?.matched_rules
          .map((finding) => finding.ref_id)
          .filter((refId) => currentRuleRefIds.has(refId)) ?? [];

      for (const refId of matchedRuleRefs) {
        sharedRuleRefs.add(refId);
      }

      const recommendationSummary = record?.recommendation.summary ?? precedent.summary;
      precedentSummaries.push(
        `- case_id=${precedent.case_id}; decision=${precedent.final_decision}; ` +
          `status=${precedent.lifecycle_status}; similarity=${precedent.similarity_score.toFixed(2)}; ` +
          `${recommendationSummary}`,
      );

      if (precedent.lifecycle_status === 'DISPUTED' && record?.human_feedback?.comment) {
        humanOverrideNotes.push(`${precedent.case_id}: ${record.human_feedback.comment}`);
      }

      for (const regulation of record?.reference_regulations ?? []) {
        regulationCitations.push(mapCaseRegulationRef(regulation));
      }
    }

    const hasConfirmedExactMatch =
      retrieval.exact_content_hash_match &&
      retrieval.precedents.some((precedent) => precedent.lifecycle_status === 'CONFIRMED');

    return {
      caseIds: retrieval.precedents.map((precedent) => precedent.case_id),
      precedentSummaries,
      sharedRuleRefs: [...sharedRuleRefs],
      regulationCitations: dedupeRegulationCitations(regulationCitations),
      humanOverrideNotes,
      coverageScore: retrieval.coverage_score,
      exactContentHashMatch: retrieval.exact_content_hash_match,
      hasConfirmedExactMatch,
      coldStart: retrieval.precedents.length === 0,
    };
  }
}
