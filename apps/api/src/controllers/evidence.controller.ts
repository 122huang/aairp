import type { FastifyInstance } from 'fastify';
import { AppError, type EvidenceSourceType } from '@aairp/shared-kernel';
import type { EvidenceService } from '@aairp/application';
import { createProbePreHandler, sendJson } from '../middleware/http.js';

export type EvidenceControllerDeps = {
  evidenceService: EvidenceService;
};

type CreateAndAttachBody = {
  review_id: string;
  finding_id: string;
  case_id?: string;
  title: string;
  evidence_source_type: string;
  issuing_institution?: string;
  issued_date?: string;
  valid_until?: string;
  scope?: {
    countries?: string[];
    categories?: string[];
    skus?: string[];
  };
  claim_risk_types?: string[];
  file: {
    filename: string;
    mime_type: string;
    content_base64: string;
  };
  judgment_context?: {
    country_id: string;
    category_id: string;
    product_sku?: string;
    ad_text: string;
    finding_summary: string;
    remediation_type?: string;
    risk_type: string;
    claim_anchor_text: string;
    matched_spans?: Array<{ field: string; start?: number; end?: number; text: string }>;
  };
};

type ConfirmLinkBody = {
  action: 'confirm' | 'override_accept' | 'override_reject';
  override_reason?: string;
};

export async function registerEvidenceController(
  app: FastifyInstance,
  deps: EvidenceControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.get<{ Params: { reviewId: string; findingId: string } }>(
    '/demo/reviews/:reviewId/findings/:findingId/evidence',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const { reviewId, findingId } = request.params;
      const links = await deps.evidenceService.listForFinding(reviewId, findingId);
      sendJson(reply, 200, { links });
    },
  );

  app.get<{ Params: { reviewId: string } }>(
    '/demo/reviews/:reviewId/evidence',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const links = await deps.evidenceService.listForReview(request.params.reviewId);
      sendJson(reply, 200, { links });
    },
  );

  app.post<{ Body: CreateAndAttachBody }>(
    '/demo/finding-evidence',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const body = request.body;
      if (!body.review_id?.trim() || !body.finding_id?.trim() || !body.title?.trim()) {
        throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'review_id, finding_id, and title are required');
      }
      if (!body.evidence_source_type?.trim()) {
        throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'evidence_source_type is required');
      }
      if (!body.file?.filename || !body.file?.content_base64) {
        throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'file.filename and file.content_base64 are required');
      }

      const jc = body.judgment_context;
      const result = await deps.evidenceService.createAndAttach(
        body.review_id.trim(),
        body.finding_id.trim(),
        {
          title: body.title.trim(),
          evidence_source_type: body.evidence_source_type.trim() as EvidenceSourceType,
          issuing_institution: body.issuing_institution,
          issued_date: body.issued_date,
          valid_until: body.valid_until,
          scope: body.scope,
          claim_risk_types: body.claim_risk_types,
          file: body.file,
        },
        {
          caseId: body.case_id?.trim(),
          judgmentContext: jc
            ? {
                review_id: body.review_id.trim(),
                finding_id: body.finding_id.trim(),
                country_id: jc.country_id,
                category_id: jc.category_id,
                product_sku: jc.product_sku,
                ad_text: jc.ad_text,
                finding_summary: jc.finding_summary,
                remediation_type: jc.remediation_type,
                risk_type: jc.risk_type,
                claim_anchor_text: jc.claim_anchor_text,
                matched_spans: jc.matched_spans,
              }
            : undefined,
        },
      );

      sendJson(reply, 201, result);
    },
  );

  app.patch<{ Params: { linkId: string }; Body: ConfirmLinkBody }>(
    '/demo/finding-evidence/:linkId/confirm',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const action = request.body?.action;
      if (action !== 'confirm' && action !== 'override_accept' && action !== 'override_reject') {
        throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'action must be confirm, override_accept, or override_reject');
      }
      const link = await deps.evidenceService.confirmLink({
        link_id: request.params.linkId,
        action,
        override_reason: request.body?.override_reason,
      });
      sendJson(reply, 200, link);
    },
  );
}
