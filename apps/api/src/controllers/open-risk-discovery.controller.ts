import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import {
  AdvertisementNotFoundError,
  ContextBuilderService,
  ReviewPipelineService,
} from '@aairp/application';
import { toOpenRiskDiscoveryResponseDto } from '../dto/open-risk-discovery.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';
import { logReviewPipelineTimings } from '../middleware/review-logging.js';
import { parseAdvertisementIdRequest } from '../validation/demo-request.js';

export type OpenRiskDiscoveryControllerDeps = {
  contextBuilderService: ContextBuilderService;
  reviewPipelineService: ReviewPipelineService;
};

export async function registerOpenRiskDiscoveryController(
  app: FastifyInstance,
  deps: OpenRiskDiscoveryControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.post(
    '/demo/open-risk-discovery',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const payload = parseAdvertisementIdRequest(request.body);

      try {
        const context = await deps.contextBuilderService.buildFromAdvertisementId(
          payload.advertisement_id,
        );
        const pipeline = await deps.reviewPipelineService.runThroughOpenRisk(context);

        logReviewPipelineTimings(
          request.log,
          {
            trace_id: request.traceId,
            review_id: pipeline.openRiskResult.reviewId,
            advertisement_id: payload.advertisement_id,
            skipped: pipeline.openRiskResult.skipped,
            skip_reason: pipeline.openRiskResult.skipReason,
            finding_count: pipeline.openRiskResult.findings.length,
          },
          {
            ...pipeline.timings,
            decisionMs: 0,
            reportMs: 0,
          },
          'open risk discovery completed',
        );

        sendJson(reply, 200, toOpenRiskDiscoveryResponseDto(pipeline.openRiskResult));
      } catch (error) {
        if (error instanceof AdvertisementNotFoundError) {
          request.log.warn(
            {
              trace_id: request.traceId,
              advertisement_id: error.advertisementId,
            },
            'open risk discovery failed: advertisement not found',
          );
          throw new AppError(
            'INVALID_REQUEST',
            400,
            'Bad Request',
            error.message,
          );
        }
        throw error;
      }
    },
  );
}
