import type { PaginatedResult } from './common.js';

export type KosSearchObjectType = 'rule' | 'case' | 'regulation';

export type KosSearchTypeFilter = KosSearchObjectType | 'all';

export type KosSearchFilters = {
  type?: KosSearchTypeFilter;
  q?: string;
  countryId?: string;
  categoryId?: string;
  jurisdiction?: string;
  status?: string;
  severity?: string;
  limit: number;
  offset: number;
};

export type KosSearchHit = {
  objectType: KosSearchObjectType;
  objectId: string;
  title: string;
  snippet?: string;
  meta: Record<string, unknown>;
};

export type KosSearchResult = PaginatedResult<KosSearchHit>;

export interface IKosSearchRepository {
  searchRules(
    filters: Omit<KosSearchFilters, 'type'>,
  ): Promise<KosSearchResult>;
  searchCasesInDb(
    filters: Omit<KosSearchFilters, 'type'>,
  ): Promise<KosSearchResult>;
  searchRegulations(
    filters: Omit<KosSearchFilters, 'type'>,
  ): Promise<KosSearchResult>;
}
