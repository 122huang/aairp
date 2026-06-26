import { describe, expect, it } from 'vitest';
import { AppError } from '@aairp/shared-kernel';
import {
  assertOnlyKnownKosSearchQueryParams,
  parseKosSearchQuery,
  toKosSearchFilters,
} from './kos-search-query.js';

describe('parseKosSearchQuery', () => {
  it('parses search facets', () => {
    expect(
      parseKosSearchQuery({
        type: 'case',
        q: ' cure ',
        country_id: 'SG',
        category_id: 'health.supplement',
        limit: '10',
        offset: '0',
      }),
    ).toEqual({
      limit: 10,
      offset: 0,
      q: 'cure',
      type: 'case',
      country_id: 'SG',
      category_id: 'health.supplement',
    });
  });

  it('maps to service filters', () => {
    expect(
      toKosSearchFilters(
        parseKosSearchQuery({ type: 'rule', country_id: 'SG', limit: '5' }),
      ),
    ).toEqual({
      type: 'rule',
      q: undefined,
      countryId: 'SG',
      categoryId: undefined,
      limit: 5,
      offset: 0,
    });
  });

  it('rejects invalid type', () => {
    expect(() => parseKosSearchQuery({ type: 'prompt' })).toThrow(AppError);
  });

  it('rejects unknown params', () => {
    expect(() => assertOnlyKnownKosSearchQueryParams({ platform_id: 'META' })).toThrow(
      AppError,
    );
  });
});
