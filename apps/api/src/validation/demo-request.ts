import { AppError } from '@aairp/shared-kernel';

export type AdvertisementIdRequest = {
  advertisement_id: string;
};

export function parseJsonObjectBody(body: unknown, fieldName = 'body'): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      `request ${fieldName} must be a JSON object`,
    );
  }
  return body as Record<string, unknown>;
}

export function parseAdvertisementIdRequest(body: unknown): AdvertisementIdRequest {
  const raw = parseJsonObjectBody(body);
  if (typeof raw.advertisement_id !== 'string' || raw.advertisement_id.trim().length === 0) {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      'advertisement_id is required',
    );
  }
  return { advertisement_id: raw.advertisement_id.trim() };
}
