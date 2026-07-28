import type { FastifyInstance } from 'fastify';
import type { ReviewContext, VisionComplianceService } from '@aairp/application';
import { DEMO_KNOWLEDGE_VERSIONS, joinVisionExtractedText } from '@aairp/application';
import { AppError } from '@aairp/shared-kernel';
import { createProbePreHandler, sendJson } from '../middleware/http.js';

export type ImageReviewExtractControllerDeps = {
  visionComplianceService: VisionComplianceService;
};

type ExtractBody = {
  image_base64?: string;
  mime_type?: string;
  country_id?: string;
  category_id?: string;
};

function toDataUrl(imageBase64: string, mimeType: string): string {
  const cleaned = imageBase64.replace(/^data:[^;]+;base64,/, '');
  return `data:${mimeType};base64,${cleaned}`;
}

export async function registerImageReviewExtractController(
  app: FastifyInstance,
  deps: ImageReviewExtractControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  /**
   * Image-review identify step: run Vision discover and return extracted visible text
   * for human confirmation before submit. Does not run the full rule pipeline.
   */
  app.post(
    '/demo/image-review/extract-text',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const body = (request.body ?? {}) as ExtractBody;
      const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64.trim() : '';
      if (!imageBase64) {
        throw new AppError(
          'INVALID_REQUEST',
          400,
          'Bad Request',
          'image_base64 is required',
        );
      }

      const mimeType =
        typeof body.mime_type === 'string' && body.mime_type.trim()
          ? body.mime_type.trim()
          : 'image/jpeg';
      const countryId =
        typeof body.country_id === 'string' && body.country_id.trim()
          ? body.country_id.trim()
          : 'SG';
      const categoryId =
        typeof body.category_id === 'string' && body.category_id.trim()
          ? body.category_id.trim()
          : 'sa.other';

      const dataUrl = toDataUrl(imageBase64, mimeType);
      const context = {
        reviewId: `rev_extract_${Date.now()}`,
        advertisementId: 'ad_extract',
        contentHash: 'extract',
        contentVersion: 1,
        dimensions: {
          tenantId: 'demo',
          countryId,
          platformId: 'SHOPEE',
          categoryId,
        },
        normalizedContent: {
          text: '',
          imageUrls: [dataUrl],
        },
        resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
        advertisementContext: {},
        tags: ['entry_mode:image', 'extract-only'],
        builtAt: new Date().toISOString(),
      } as ReviewContext;

      const result = await deps.visionComplianceService.discover(context);
      if (result.skipped) {
        throw new AppError(
          'SERVICE_UNAVAILABLE',
          503,
          'Service Unavailable',
          result.skipReason === 'VISION_MODE_OFF'
            ? 'Vision is off — paste text manually or set AAIRP_VISION_MODE=live|stub'
            : 'Vision skipped — paste text manually',
        );
      }

      const lines = (result.extractedText ?? [])
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const text = joinVisionExtractedText(lines) ?? '';

      sendJson(reply, 200, {
        text,
        lines,
        slice_count: result.manifests.reduce((sum, m) => sum + m.slices.length, 0),
        vision_skipped: result.skipped,
      });
    },
  );
}
