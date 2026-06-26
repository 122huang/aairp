import type { KosSearchHit, KosSearchResult } from '@aairp/shared-kernel';

export type KosSearchHitDto = {
  object_type: 'rule' | 'case' | 'regulation';
  object_id: string;
  title: string;
  snippet?: string;
  meta: Record<string, unknown>;
};

export type KosSearchResponseDto = {
  items: KosSearchHitDto[];
  total: number;
  limit: number;
  offset: number;
  type?: string;
  q?: string;
  country_id?: string;
  category_id?: string;
};

function toHitDto(hit: KosSearchHit): KosSearchHitDto {
  return {
    object_type: hit.objectType,
    object_id: hit.objectId,
    title: hit.title,
    snippet: hit.snippet,
    meta: hit.meta,
  };
}

export function toKosSearchResponseDto(
  result: KosSearchResult,
  query: {
    type?: string;
    q?: string;
    country_id?: string;
    category_id?: string;
  },
): KosSearchResponseDto {
  return {
    items: result.items.map(toHitDto),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    ...(query.type ? { type: query.type } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.country_id ? { country_id: query.country_id } : {}),
    ...(query.category_id ? { category_id: query.category_id } : {}),
  };
}
