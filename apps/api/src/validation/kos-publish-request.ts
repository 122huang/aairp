import { AppError } from '@aairp/shared-kernel';
import type { KosPublishObjectType } from '@aairp/shared-kernel';

const VALID_OBJECT_TYPES = new Set<KosPublishObjectType>([
  'rule',
  'regulation',
  'playbook',
  'prompt',
]);

export type KosPublishRequestBody = {
  object_type: KosPublishObjectType;
  version_id: string;
};

export function parseKosPublishRequestBody(body: unknown): KosPublishRequestBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }

  const record = body as Record<string, unknown>;
  const objectType = record.object_type;
  const versionId = record.version_id;

  if (typeof objectType !== 'string' || !VALID_OBJECT_TYPES.has(objectType as KosPublishObjectType)) {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      'Invalid field: object_type',
    );
  }

  if (typeof versionId !== 'string' || versionId.trim() === '') {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      'Invalid field: version_id',
    );
  }

  return {
    object_type: objectType as KosPublishObjectType,
    version_id: versionId.trim(),
  };
}

export function parseKosActorHeaders(headers: Record<string, unknown>): {
  actor?: string;
  traceId?: string;
} {
  const actor =
    typeof headers['x-kos-actor'] === 'string' ? headers['x-kos-actor'] : undefined;
  const traceId =
    typeof headers['x-trace-id'] === 'string'
      ? headers['x-trace-id']
      : typeof headers['x-request-id'] === 'string'
        ? headers['x-request-id']
        : undefined;

  return { actor, traceId };
}
