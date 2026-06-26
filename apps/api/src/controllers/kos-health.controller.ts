import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import { toKosHealthResponseDto } from '../dto/kos-health.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type KosHealthControllerDeps = {
  serviceName: string;
  version: string;
};

export async function registerKosHealthController(
  app: FastifyInstance,
  deps: KosHealthControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.get(
    '/health',
    { preHandler: probePreHandler },
    async (_request, reply) => {
      sendJson(
        reply,
        200,
        toKosHealthResponseDto({
          serviceName: deps.serviceName,
          version: deps.version,
          timestamp: new Date().toISOString(),
        }),
      );
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
}
