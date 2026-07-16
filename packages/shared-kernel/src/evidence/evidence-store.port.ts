import type {
  AttachEvidenceInput,
  ConfirmEvidenceLinkInput,
  CreateEvidenceInput,
  EvidenceRecord,
  FindingEvidenceLink,
  UpdateEvidenceLinkInput,
} from './evidence-types.js';

export type IEvidenceStore = {
  createEvidence(input: CreateEvidenceInput): Promise<EvidenceRecord>;
  findEvidenceById(evidenceId: string): Promise<EvidenceRecord | null>;
  attachToFinding(input: AttachEvidenceInput): Promise<FindingEvidenceLink>;
  updateLink(input: UpdateEvidenceLinkInput): Promise<FindingEvidenceLink>;
  findLinkById(linkId: string): Promise<FindingEvidenceLink | null>;
  listLinksForFinding(reviewId: string, findingId: string): Promise<FindingEvidenceLink[]>;
  listLinksForReview(reviewId: string): Promise<FindingEvidenceLink[]>;
  confirmLink(input: ConfirmEvidenceLinkInput): Promise<FindingEvidenceLink>;
  readEvidenceFile(storagePath: string): Promise<Buffer>;
};
