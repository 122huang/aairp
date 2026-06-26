import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import {
  AdvertisementUploadService,
  AdvertisementUploadValidationError,
} from '@aairp/application';
import { toAdvertisementUploadResponseDto } from '../dto/advertisement-upload.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';

export type AdvertisementUploadControllerDeps = {
  advertisementUploadService: AdvertisementUploadService;
};

export async function registerAdvertisementUploadController(
  app: FastifyInstance,
  deps: AdvertisementUploadControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.post(
    '/demo/advertisements',
    { preHandler: probePreHandler },
    async (request, reply) => {
      try {
        const advertisement = await deps.advertisementUploadService.upload(request.body);
        request.log.info(
          {
            trace_id: request.traceId,
            advertisement_id: advertisement.advertisementId,
            tenant_id: advertisement.tenantId,
          },
          'advertisement upload succeeded',
        );
        sendJson(reply, 201, toAdvertisementUploadResponseDto(advertisement));
      } catch (error) {
        if (error instanceof AdvertisementUploadValidationError) {
          request.log.warn(
            {
              trace_id: request.traceId,
              errors: error.issues,
            },
            'advertisement upload validation failed',
          );
          throw new AppError(
            'INVALID_REQUEST',
            400,
            'Bad Request',
            error.message,
            { errors: error.issues },
          );
        }
        throw error;
      }
    },
  );
}
