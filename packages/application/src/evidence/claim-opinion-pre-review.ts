import {
  supportsEvidenceAttachment,
  type ClaimOpinion,
  type CreateEvidenceInput,
  type EvidenceJudgmentContext,
  type ReviewReportFindingSummary,
} from '@aairp/shared-kernel';
import { composeClaimOpinions } from './claim-opinion.compose.js';
import type { EvidencePoolFileInput } from './evidence-pool.js';
import { evidenceTitleFromFilename } from './evidence-pool.js';
import type { EvidenceLinkWithRecord, EvidenceService } from './evidence.service.js';

export type ClaimOpinionPreReviewInput = {
  reviewId: string;
  caseId?: string;
  countryId: string;
  categoryId: string;
  productSku?: string;
  adText: string;
  findings: ReviewReportFindingSummary[];
  pool: EvidencePoolFileInput[];
};

function riskTypeOf(finding: ReviewReportFindingSummary): string {
  return finding.rewriteSuggestions?.[0]?.riskType ?? finding.refId;
}

function judgmentContext(
  input: ClaimOpinionPreReviewInput,
  finding: ReviewReportFindingSummary,
): EvidenceJudgmentContext {
  return {
    review_id: input.reviewId,
    country_id: input.countryId,
    category_id: input.categoryId,
    ...(input.productSku ? { product_sku: input.productSku } : {}),
    ad_text: input.adText,
    finding_id: finding.findingId,
    finding_summary: finding.summary,
    ...(finding.remediationType ? { remediation_type: finding.remediationType } : {}),
    risk_type: riskTypeOf(finding),
    claim_anchor_text: finding.evidenceSpans?.[0]?.text ?? finding.summary,
    ...(finding.evidenceSpans?.length ? { matched_spans: finding.evidenceSpans } : {}),
  };
}

function toCreateInput(
  file: EvidencePoolFileInput,
  input: ClaimOpinionPreReviewInput,
): CreateEvidenceInput {
  const title = evidenceTitleFromFilename(file.filename) || file.filename;
  return {
    title,
    evidence_source_type: file.evidence_source_type,
    scope: {
      countries: [input.countryId],
      categories: [input.categoryId],
      ...(input.productSku ? { skus: [input.productSku] } : {}),
    },
    file: {
      filename: file.filename,
      mime_type: file.mime_type,
      content_base64: file.content_base64,
    },
  };
}

export async function runClaimOpinionPreReview(
  evidenceService: EvidenceService | undefined,
  input: ClaimOpinionPreReviewInput,
): Promise<ClaimOpinion[]> {
  const attachable = input.findings.filter((finding) =>
    supportsEvidenceAttachment(finding.remediationType, finding.decision),
  );

  const links: EvidenceLinkWithRecord[] = [];
  if (evidenceService && input.pool.length > 0 && attachable.length > 0) {
    const targets = attachable.map((finding) => ({
      findingId: finding.findingId,
      judgmentContext: judgmentContext(input, finding),
    }));
    for (const file of input.pool) {
      const created = await evidenceService.attachPoolFile(
        input.reviewId,
        toCreateInput(file, input),
        targets,
        input.caseId,
      );
      links.push(...created);
    }
  }

  return composeClaimOpinions({
    findings: input.findings,
    links,
    poolFileCount: input.pool.length,
    poolFiles: input.pool.map((file) => ({
      title: evidenceTitleFromFilename(file.filename) || file.filename,
      filename: file.filename,
    })),
  });
}
