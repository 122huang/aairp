import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import {
  AdvertisementNotFoundError,
  ContextBuilderService,
  ReviewPipelineService,
} from '@aairp/application';
import { toDecisionResponseDto } from '../dto/decision.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';
import { logReviewPipelineTimings } from '../middleware/review-logging.js';
import { parseAdvertisementIdRequest } from '../validation/demo-request.js';

export type DecisionControllerDeps = {
  contextBuilderService: ContextBuilderService;
  reviewPipelineService: ReviewPipelineService;
};

export async function registerDecisionController(
  app: FastifyInstance,
  deps: DecisionControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.post(
    '/demo/decision',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const payload = parseAdvertisementIdRequest(request.body);

      try {
        const context = await deps.contextBuilderService.buildFromAdvertisementId(
          payload.advertisement_id,
        );
        const pipeline = await deps.reviewPipelineService.runThroughDecision(context);

        logReviewPipelineTimings(
          request.log,
          {
            trace_id: request.traceId,
            review_id: pipeline.decision.reviewId,
            advertisement_id: payload.advertisement_id,
            final_decision: pipeline.decision.finalDecision,
            confidence: pipeline.decision.confidence,
            open_risk_skipped: pipeline.openRiskResult.skipped,
          },
          pipeline.timings,
          'decision fusion completed',
        );

        sendJson(reply, 200, toDecisionResponseDto(pipeline.decision));
      } catch (error) {
        if (error instanceof AdvertisementNotFoundError) {
          request.log.warn(
            {
              trace_id: request.traceId,
              advertisement_id: error.advertisementId,
            },
            'decision fusion failed: advertisement not found',
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
