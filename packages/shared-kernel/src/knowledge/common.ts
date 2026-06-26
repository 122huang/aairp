export type PackVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type PaginationParams = {
  limit?: number;
  offset?: number;
  q?: string;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
