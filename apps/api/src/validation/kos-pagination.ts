import { AppError } from '@aairp/shared-kernel';

export const KOS_PAGINATION_DEFAULTS = {
  limit: 20,
  maxLimit: 100,
  offset: 0,
  maxQueryLength: 500,
} as const;

export const KOS_LIST_QUERY_KEYS = ['limit', 'offset', 'q'] as const;

export type KosListQuery = {
  limit: number;
  offset: number;
  q?: string;
};

function invalidQueryParam(name: string): never {
  throw new AppError(
    'INVALID_REQUEST',
    400,
    'Bad Request',
    `Invalid query parameter: ${name}`,
  );
}

function parsePositiveInt(value: unknown, name: string): number {
  if (value === undefined) {
    return name === 'limit'
      ? KOS_PAGINATION_DEFAULTS.limit
      : KOS_PAGINATION_DEFAULTS.offset;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    invalidQueryParam(name);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    invalidQueryParam(name);
  }

  listingParamBounds(name, parsed);
  return parsed;
}

function listingParamBounds(name: string, value: number): void {
  if (name === 'limit') {
    if (value < 1 || value > KOS_PAGINATION_DEFAULTS.maxLimit) {
      invalidQueryParam(name);
    }
    return;
  }

  if (value < 0) {
    invalidQueryParam(name);
  }
}

function parseSearchQuery(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    invalidQueryParam('q');
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length > KOS_PAGINATION_DEFAULTS.maxQueryLength) {
    invalidQueryParam('q');
  }

  return trimmed;
}

export function parseKosListQuery(query: Record<string, unknown>): KosListQuery {
  const limit = parsePositiveInt(query.limit, 'limit');
  const offset = parsePositiveInt(query.offset, 'offset');
  const q = parseSearchQuery(query.q);

  return q === undefined ? { limit, offset } : { limit, offset, q };
}

export function assertOnlyKnownKosListQueryParams(
  query: Record<string, unknown>,
  extraAllowedKeys: readonly string[] = [],
): void {
  const allowed = new Set<string>([...KOS_LIST_QUERY_KEYS, ...extraAllowedKeys]);
  const unknown = Object.keys(query).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    invalidQueryParam(unknown[0]!);
  }
}
