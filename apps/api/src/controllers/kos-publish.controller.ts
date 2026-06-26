import type { FastifyInstance } from 'fastify';
import type { KosPublishService } from '@aairp/application';
import { AppError, KosPublishError } from '@aairp/shared-kernel';
import { toKosPublishedVersionDto } from '../dto/kos-publish.dto.js';
import { sendJson } from '../middleware/http.js';
import {
  parseKosActorHeaders,
  parseKosPublishRequestBody,
} from '../validation/kos-publish-request.js';

export type KosPublishControllerDeps = {
  kosPublishService: KosPublishService;
};

function mapPublishError(error: unknown): never {
  if (error instanceof KosPublishError) {
    throw new AppError(
      error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'CONFLICT',
      error.code === 'NOT_FOUND' ? 404 : 409,
      error.code === 'NOT_FOUND' ? 'Not Found' : 'Conflict',
      error.message,
    );
  }
  throw error;
}

export async function registerKosPublishController(
  app: FastifyInstance,
  deps: KosPublishControllerDeps,
): Promise<void> {
  app.post('/publish', async (request, reply) => {
    const body = parseKosPublishRequestBody(request.body);
    const headers = parseKosActorHeaders(request.headers as Record<string, unknown>);

    try {
      const version = await deps.kosPublishService.publish(
        body.object_type,
        body.version_id,
        {
          actor: headers.actor,
          traceId: request.traceId ?? headers.traceId,
        },
      );
      sendJson(reply, 200, toKosPublishedVersionDto(version));
    } catch (error) {
      mapPublishError(error);
    }
  });

  app.post('/rollback', async (request, reply) => {
    const body = parseKosPublishRequestBody(request.body);
    const headers = parseKosActorHeaders(request.headers as Record<string, unknown>);

    try {
      const version = await deps.kosPublishService.rollback(
        body.object_type,
        body.version_id,
        {
          actor: headers.actor,
          traceId: request.traceId ?? headers.traceId,
        },
      );
      sendJson(reply, 200, toKosPublishedVersionDto(version));
    } catch (error) {
      mapPublishError(error);
    }
  });
}
