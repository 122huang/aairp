import type {
  AttachEvidenceInput,
  ConfirmEvidenceLinkInput,
  CreateEvidenceInput,
  EvidenceJudgmentContext,
  EvidenceRecord,
  FindingEvidenceLink,
  IEvidenceStore,
} from '@aairp/shared-kernel';
import type { EvidenceJudgmentService } from './evidence-judgment.service.js';

export type EvidenceLinkWithRecord = FindingEvidenceLink & {
  evidence: EvidenceRecord;
};

export type CreateAndAttachOptions = {
  caseId?: string;
  judgmentContext?: EvidenceJudgmentContext;
};

export class EvidenceService {
  constructor(
    private readonly store: IEvidenceStore,
    private readonly judgmentService?: EvidenceJudgmentService,
  ) {}

  createEvidence(input: CreateEvidenceInput): Promise<EvidenceRecord> {
    return this.store.createEvidence(input);
  }

  attachToFinding(input: AttachEvidenceInput): Promise<FindingEvidenceLink> {
    return this.store.attachToFinding(input);
  }

  async createAndAttach(
    reviewId: string,
    findingId: string,
    evidenceInput: CreateEvidenceInput,
    options: CreateAndAttachOptions = {},
  ): Promise<EvidenceLinkWithRecord> {
    const evidence = await this.store.createEvidence(evidenceInput);
    let link = await this.store.attachToFinding({
      review_id: reviewId,
      finding_id: findingId,
      evidence_id: evidence.evidence_id,
      case_id: options.caseId,
    });

    if (this.judgmentService && options.judgmentContext) {
      const judgment = await this.judgmentService.judgeAttachedEvidence(evidence, options.judgmentContext);
      link = await this.store.updateLink({
        link_id: link.link_id,
        status: 'AI_JUDGED_PENDING_CONFIRMATION',
        ai_judgment: judgment,
      });
    }

    return { ...link, evidence };
  }

  confirmLink(input: ConfirmEvidenceLinkInput): Promise<FindingEvidenceLink> {
    return this.store.confirmLink(input);
  }

  async listForFinding(reviewId: string, findingId: string): Promise<EvidenceLinkWithRecord[]> {
    const links = await this.store.listLinksForFinding(reviewId, findingId);
    return this.hydrateLinks(links);
  }

  async listForReview(reviewId: string): Promise<EvidenceLinkWithRecord[]> {
    const links = await this.store.listLinksForReview(reviewId);
    return this.hydrateLinks(links);
  }

  readEvidenceFile(storagePath: string): Promise<Buffer> {
    return this.store.readEvidenceFile(storagePath);
  }

  private async hydrateLinks(links: FindingEvidenceLink[]): Promise<EvidenceLinkWithRecord[]> {
    const results: EvidenceLinkWithRecord[] = [];
    for (const link of links) {
      const evidence = await this.store.findEvidenceById(link.evidence_id);
      if (evidence) {
        results.push({ ...link, evidence });
      }
    }
    return results;
  }
}
