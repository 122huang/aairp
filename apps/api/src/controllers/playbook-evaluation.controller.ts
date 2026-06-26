import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import {
  AdvertisementNotFoundError,
  ContextBuilderService,
  PlaybookEngineService,
} from '@aairp/application';
import { parseAdvertisementIdRequest } from '../validation/demo-request.js';
import { toPlaybookEvaluationResponseDto } from '../dto/playbook-evaluation.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';

export type PlaybookEvaluationControllerDeps = {
  contextBuilderService: ContextBuilderService;
  playbookEngineService: PlaybookEngineService;
};

export async function registerPlaybookEvaluationController(
  app: FastifyInstance,
  deps: PlaybookEvaluationControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.post(
    '/demo/playbook-evaluation',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const payload = parseAdvertisementIdRequest(request.body);

      try {
        const context = await deps.contextBuilderService.buildFromAdvertisementId(
          payload.advertisement_id,
        );
        const result = deps.playbookEngineService.evaluate(context);

        request.log.info(
          {
            trace_id: request.traceId,
            review_id: result.reviewId,
            advertisement_id: payload.advertisement_id,
            finding_count: result.findings.length,
          },
          'playbook evaluation completed',
        );

        sendJson(reply, 200, toPlaybookEvaluationResponseDto(result));
      } catch (error) {
        if (error instanceof AdvertisementNotFoundError) {
          request.log.warn(
            {
              trace_id: request.traceId,
              advertisement_id: error.advertisementId,
            },
            'playbook evaluation failed: advertisement not found',
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
