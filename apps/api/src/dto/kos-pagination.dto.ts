import type { PaginatedResult } from '@aairp/shared-kernel';

export type PaginatedResponseDto<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  q?: string;
};

export function toPaginatedResponseDto<T>(
  result: PaginatedResult<T>,
  q?: string,
): PaginatedResponseDto<T> {
  return q === undefined
    ? {
        items: result.items,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      }
    : {
        items: result.items,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        q,
      };
}
