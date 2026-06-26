import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import {
  AdvertisementNotFoundError,
  ContextBuilderService,
} from '@aairp/application';
import { parseAdvertisementIdRequest } from '../validation/demo-request.js';
import { toReviewContextResponseDto } from '../dto/review-context.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';

export type ReviewContextControllerDeps = {
  contextBuilderService: ContextBuilderService;
};

export async function registerReviewContextController(
  app: FastifyInstance,
  deps: ReviewContextControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.post(
    '/demo/review-context',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const payload = parseAdvertisementIdRequest(request.body);

      try {
        const context = await deps.contextBuilderService.buildFromAdvertisementId(
          payload.advertisement_id,
        );

        request.log.info(
          {
            trace_id: request.traceId,
            review_id: context.reviewId,
            advertisement_id: context.advertisementId,
          },
          'review context built',
        );

        sendJson(reply, 200, toReviewContextResponseDto(context));
      } catch (error) {
        if (error instanceof AdvertisementNotFoundError) {
          request.log.warn(
            {
              trace_id: request.traceId,
              advertisement_id: error.advertisementId,
            },
            'review context build failed: advertisement not found',
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
