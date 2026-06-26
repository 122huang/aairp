import { AppError } from '@aairp/shared-kernel';
import type { KosSearchTypeFilter } from '@aairp/shared-kernel';
import {
  KOS_LIST_QUERY_KEYS,
  parseKosListQuery,
  type KosListQuery,
} from './kos-pagination.js';

export const KOS_SEARCH_FACET_KEYS = [
  'type',
  'country_id',
  'category_id',
  'jurisdiction',
  'status',
  'severity',
] as const;

export type KosSearchQuery = KosListQuery & {
  type?: KosSearchTypeFilter;
  country_id?: string;
  category_id?: string;
  jurisdiction?: string;
  status?: string;
  severity?: string;
};

const VALID_TYPES = new Set<KosSearchTypeFilter>(['rule', 'case', 'regulation', 'all']);

function parseFacet(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      `Invalid query parameter: ${name}`,
    );
  }

  return value.trim();
}

function parseType(value: unknown): KosSearchTypeFilter | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      'Invalid query parameter: type',
    );
  }

  const normalized = value.trim().toLowerCase() as KosSearchTypeFilter;
  if (!VALID_TYPES.has(normalized)) {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      'Invalid query parameter: type',
    );
  }

  return normalized;
}

export function parseKosSearchQuery(query: Record<string, unknown>): KosSearchQuery {
  const list = parseKosListQuery(query);

  return {
    ...list,
    type: parseType(query.type),
    country_id: parseFacet(query.country_id, 'country_id'),
    category_id: parseFacet(query.category_id, 'category_id'),
    jurisdiction: parseFacet(query.jurisdiction, 'jurisdiction'),
    status: parseFacet(query.status, 'status'),
    severity: parseFacet(query.severity, 'severity'),
  };
}

export function assertOnlyKnownKosSearchQueryParams(
  query: Record<string, unknown>,
): void {
  const allowed = new Set<string>([...KOS_LIST_QUERY_KEYS, ...KOS_SEARCH_FACET_KEYS]);
  const unknown = Object.keys(query).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      `Invalid query parameter: ${unknown[0]}`,
    );
  }
}

export function toKosSearchFilters(query: KosSearchQuery) {
  return {
    type: query.type,
    q: query.q,
    countryId: query.country_id,
    categoryId: query.category_id,
    jurisdiction: query.jurisdiction,
    status: query.status,
    severity: query.severity,
    limit: query.limit,
    offset: query.offset,
  };
}
