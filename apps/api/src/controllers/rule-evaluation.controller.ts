import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import {
  AdvertisementNotFoundError,
  ContextBuilderService,
  RuleEngineService,
} from '@aairp/application';
import { parseAdvertisementIdRequest } from '../validation/demo-request.js';
import { toRuleEvaluationResponseDto } from '../dto/rule-evaluation.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';

export type RuleEvaluationControllerDeps = {
  contextBuilderService: ContextBuilderService;
  ruleEngineService: RuleEngineService;
};

export async function registerRuleEvaluationController(
  app: FastifyInstance,
  deps: RuleEvaluationControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.post(
    '/demo/rule-evaluation',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const payload = parseAdvertisementIdRequest(request.body);

      try {
        const context = await deps.contextBuilderService.buildFromAdvertisementId(
          payload.advertisement_id,
        );
        const result = deps.ruleEngineService.evaluate(context);

        request.log.info(
          {
            trace_id: request.traceId,
            review_id: result.reviewId,
            advertisement_id: payload.advertisement_id,
            finding_count: result.findings.length,
            has_blocker: result.hasBlocker,
          },
          'rule evaluation completed',
        );

        sendJson(reply, 200, toRuleEvaluationResponseDto(result));
      } catch (error) {
        if (error instanceof AdvertisementNotFoundError) {
          request.log.warn(
            {
              trace_id: request.traceId,
              advertisement_id: error.advertisementId,
            },
            'rule evaluation failed: advertisement not found',
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
