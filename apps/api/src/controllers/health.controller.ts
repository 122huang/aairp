import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import type { HealthService } from '@aairp/application';
import {
  toHealthResponseDto,
  toReadinessChecksDto,
  toReadyResponseDto,
} from '../dto/health.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';
import {
  assertOnlyKnownReadyQueryParams,
  parseVerboseQuery,
} from '../validation/query-params.js';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type HealthControllerDeps = {
  healthService: HealthService;
};

export async function registerHealthController(
  app: FastifyInstance,
  deps: HealthControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.get(
    '/health',
    { preHandler: probePreHandler },
    async (_request, reply) => {
      const result = deps.healthService.checkLiveness();
      sendJson(reply, 200, toHealthResponseDto(result));
    },
  );

  for (const method of MUTATING_METHODS) {
    app.route({
      method,
      url: '/health',
      preHandler: probePreHandler,
      handler: async () => {
        throw new AppError(
          'METHOD_NOT_ALLOWED',
          405,
          'Method Not Allowed',
          'Method not allowed',
        );
      },
    });
  }

  app.get(
    '/ready',
    { preHandler: probePreHandler },
    async (request, reply) => {
      assertOnlyKnownReadyQueryParams(
        request.query as Record<string, unknown>,
      );
      const verbose = parseVerboseQuery(
        (request.query as Record<string, unknown>).verbose,
      );

      const result = await deps.healthService.checkReadiness();

      if (result.status === 'not_ready') {
        throw new AppError(
          'SERVICE_UNAVAILABLE',
          503,
          'Service Unavailable',
          'One or more dependencies are not ready',
          { checks: toReadinessChecksDto(result.checks) },
        );
      }

      sendJson(reply, 200, toReadyResponseDto(result, verbose));
    },
  );

  for (const method of MUTATING_METHODS) {
    app.route({
      method,
      url: '/ready',
      preHandler: probePreHandler,
      handler: async () => {
        throw new AppError(
          'METHOD_NOT_ALLOWED',
          405,
          'Method Not Allowed',
          'Method not allowed',
        );
      },
    });
  }
}
