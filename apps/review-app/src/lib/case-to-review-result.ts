import type { CaseMatchedFindingDto, CaseRecordDto } from '@/api/cases';
import type { DemoReviewResponse, ReviewFindingDto } from '@/api/review';

function mapFinding(module: string, finding: CaseMatchedFindingDto): ReviewFindingDto {
  const spans =
    finding.evaluation_detail?.matchedSpans ?? finding.evaluation_detail?.evidenceSpans ?? [];
  return {
    finding_id: finding.finding_id,
    module,
    ref_id: finding.ref_id,
    severity: finding.severity,
    decision: finding.decision,
    summary: finding.summary,
    ...(finding.remediation_type ? { remediation_type: finding.remediation_type } : {}),
    ...(spans.length
      ? {
          evidence_spans: spans.map((span) => ({
            field: span.field,
            start: span.start,
            end: span.end,
            text: span.text,
          })),
        }
      : {}),
  };
}

/** Map a persisted CaseRecord into the shape SingleReviewPanel already renders. */
export function caseRecordToDemoReviewResponse(record: CaseRecordDto): DemoReviewResponse {
  const findings: ReviewFindingDto[] = [
    ...record.matched_rules.map((f) => mapFinding('RULE', f)),
    ...record.matched_playbooks.map((f) => mapFinding('PLAYBOOK', f)),
    ...record.llm_analysis.findings.map((f) => mapFinding('LLM', f)),
    ...(record.vision_analysis?.findings ?? []).map((f) => mapFinding('VISION', f)),
  ];

  const text = record.advertisement.content.text ?? '';
  const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text;

  return {
    review_id: record.review_id,
    advertisement_id: record.advertisement_id,
    final_decision: record.decision.final_decision,
    confidence: record.decision.confidence,
    rationale: record.decision.rationale,
    finding_counts: {
      rule: record.decision.finding_counts.rule,
      playbook: record.decision.finding_counts.playbook,
      llm: record.decision.finding_counts.llm,
      ...(record.decision.finding_counts.case !== undefined
        ? { case: record.decision.finding_counts.case }
        : {}),
    },
    report_html: '',
    summary: {
      final_decision: record.decision.final_decision,
      confidence: record.decision.confidence,
      rationale: record.decision.rationale,
      advertisement: {
        text_preview: preview,
        country_id: record.dimensions.country_id,
        platform_id: record.dimensions.platform_id,
        category_id: record.dimensions.category_id,
      },
      findings,
      open_risk_skipped: record.llm_analysis.skipped,
      ...(record.llm_analysis.skip_reason
        ? { open_risk_skip_reason: record.llm_analysis.skip_reason }
        : {}),
    },
    generated_at: record.decision.decided_at || record.created_at,
    case_id: record.case_id,
    ...(record.thread_id ? { thread_id: record.thread_id } : {}),
    ...(record.parent_case_id ? { parent_case_id: record.parent_case_id } : {}),
    ...(record.reviewer_id ? { reviewer_id: record.reviewer_id } : {}),
  };
}
