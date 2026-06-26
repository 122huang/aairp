import { AppError } from '@aairp/shared-kernel';

const VERBOSE_VALUES = new Set(['true', 'false', '1', '0']);

export function parseVerboseQuery(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }

  if (typeof value !== 'string') {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      'Invalid query parameter: verbose',
    );
  }

  const normalized = value.trim().toLowerCase();
  if (!VERBOSE_VALUES.has(normalized)) {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      'Invalid query parameter: verbose',
    );
  }

  return normalized === 'true' || normalized === '1';
}

export function assertOnlyKnownReadyQueryParams(
  query: Record<string, unknown>,
): void {
  const keys = Object.keys(query);
  const unknown = keys.filter((key) => key !== 'verbose');
  if (unknown.length > 0) {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      `Invalid query parameter: ${unknown[0]}`,
    );
  }
}

export function validateAcceptHeader(acceptHeader: string | undefined): void {
  if (!acceptHeader) {
    return;
  }

  const acceptable = acceptHeader
    .split(',')
    .some((part) => {
      const mediaType = part.split(';')[0]?.trim().toLowerCase();
      return mediaType === 'application/json' || mediaType === '*/*';
    });

  if (!acceptable) {
    throw new AppError(
      'NOT_ACCEPTABLE',
      406,
      'Not Acceptable',
      'Accept header not supported',
    );
  }
}
