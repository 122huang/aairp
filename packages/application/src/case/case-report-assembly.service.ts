import type {
  CaseRecord,
  FindingEvidenceLink,
  ICaseStore,
  RemediationType,
} from '@aairp/shared-kernel';
import { AppError, isBusinessHandoffRemediationType } from '@aairp/shared-kernel';
import type { EvidenceService } from '../evidence/evidence.service.js';
import { deriveCaseEffectiveStatus } from './case-effective-status.js';
import {
  collectCaseFindings,
  evaluateBusinessHandoffEligibility,
  filterBusinessHandoffFindings,
} from './case-report-eligibility.js';
import type {
  CaseReportEvidenceLink,
  CaseReportModel,
  CaseReportTemplate,
  PublishTodoItem,
} from './case-report.model.js';

export type CaseReportAssemblyDeps = {
  caseStore: ICaseStore;
  evidenceService: EvidenceService;
  now?: () => Date;
};

function sortThreadCases(cases: CaseRecord[]): CaseRecord[] {
  return [...cases].sort((a, b) => {
    const byCreated = a.created_at.localeCompare(b.created_at);
    if (byCreated !== 0) return byCreated;
    return a.case_id.localeCompare(b.case_id);
  });
}

function toReportEvidenceLinks(
  links: Array<FindingEvidenceLink & { evidence: CaseReportEvidenceLink['evidence'] }>,
): CaseReportEvidenceLink[] {
  return links.map((link) => ({
    link_id: link.link_id,
    case_id: link.case_id,
    review_id: link.review_id,
    finding_id: link.finding_id,
    evidence_id: link.evidence_id,
    status: link.status,
    ai_judgment: link.ai_judgment,
    override_reason: link.override_reason,
    confirmed_at: link.confirmed_at,
    created_at: link.created_at,
    evidence: {
      evidence_id: link.evidence.evidence_id,
      title: link.evidence.title,
      evidence_source_type: link.evidence.evidence_source_type,
      issuing_institution: link.evidence.issuing_institution,
      issued_date: link.evidence.issued_date,
      valid_until: link.evidence.valid_until,
      scope: link.evidence.scope,
      claim_risk_types: link.evidence.claim_risk_types,
      file: {
        filename: link.evidence.file.filename,
        mime_type: link.evidence.file.mime_type,
        storage_path: link.evidence.file.storage_path,
      },
      created_at: link.evidence.created_at,
    },
  }));
}

export class CaseReportAssemblyService {
  constructor(private readonly deps: CaseReportAssemblyDeps) {}

  async assemble(caseId: string, template: CaseReportTemplate): Promise<CaseReportModel> {
    const caseRecord = await this.deps.caseStore.findByCaseId(caseId);
    if (!caseRecord) {
      throw new AppError('NOT_FOUND', 404, 'Not Found', `case not found: ${caseId}`);
    }

    const threadId = caseRecord.thread_id ?? caseRecord.case_id;
    const allCases = await this.deps.caseStore.exportAll();
    const threadCases = sortThreadCases(
      allCases.filter((entry) => (entry.thread_id ?? entry.case_id) === threadId),
    );

    const evidenceByReview = new Map<string, CaseReportEvidenceLink[]>();
    for (const threadCase of threadCases) {
      if (evidenceByReview.has(threadCase.review_id)) continue;
      const hydrated = await this.deps.evidenceService.listForReview(threadCase.review_id);
      evidenceByReview.set(threadCase.review_id, toReportEvidenceLinks(hydrated));
    }

    const currentEvidence = evidenceByReview.get(caseRecord.review_id) ?? [];
    const allEvidence = threadCases.flatMap(
      (threadCase) => evidenceByReview.get(threadCase.review_id) ?? [],
    );

    const findings = collectCaseFindings(caseRecord);
    const handoffFindings = filterBusinessHandoffFindings(findings).filter((finding) =>
      isBusinessHandoffRemediationType(finding.remediation_type),
    );
    const publishTodos: PublishTodoItem[] = handoffFindings.map((finding) => ({
      finding_id: finding.finding_id,
      ref_id: finding.ref_id,
      summary: finding.summary,
      remediation_type: finding.remediation_type as RemediationType,
      decision: finding.decision,
    }));

    const businessHandoff = evaluateBusinessHandoffEligibility(caseRecord, currentEvidence);
    const effective = deriveCaseEffectiveStatus(
      caseRecord.decision.final_decision,
      findings,
      currentEvidence,
    );

    return {
      template,
      generated_at: (this.deps.now?.() ?? new Date()).toISOString(),
      case: caseRecord,
      thread_cases: threadCases,
      findings,
      handoff_findings: handoffFindings,
      publish_todos: publishTodos,
      evidence_links: template === 'legal_audit' ? allEvidence : currentEvidence,
      business_handoff: businessHandoff,
      effective,
    };
  }
}
