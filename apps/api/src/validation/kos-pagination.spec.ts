import { describe, expect, it } from 'vitest';
import { AppError } from '@aairp/shared-kernel';
import {
  KOS_PAGINATION_DEFAULTS,
  assertOnlyKnownKosListQueryParams,
  parseKosListQuery,
} from './kos-pagination.js';

describe('parseKosListQuery', () => {
  it('returns defaults when query is empty', () => {
    expect(parseKosListQuery({})).toEqual({
      limit: KOS_PAGINATION_DEFAULTS.limit,
      offset: KOS_PAGINATION_DEFAULTS.offset,
    });
  });

  it('parses limit, offset, and q', () => {
    expect(parseKosListQuery({ limit: '10', offset: '5', q: ' cure ' })).toEqual({
      limit: 10,
      offset: 5,
      q: 'cure',
    });
  });

  it('omits q when blank', () => {
    expect(parseKosListQuery({ q: '   ' })).toEqual({
      limit: KOS_PAGINATION_DEFAULTS.limit,
      offset: KOS_PAGINATION_DEFAULTS.offset,
    });
  });

  it('rejects limit above max', () => {
    expect(() => parseKosListQuery({ limit: '101' })).toThrow(AppError);
  });

  it('rejects negative offset', () => {
    expect(() => parseKosListQuery({ offset: '-1' })).toThrow(AppError);
  });

  it('rejects non-integer limit', () => {
    expect(() => parseKosListQuery({ limit: '10.5' })).toThrow(AppError);
  });
});

describe('assertOnlyKnownKosListQueryParams', () => {
  it('allows standard list keys', () => {
    expect(() =>
      assertOnlyKnownKosListQueryParams({ limit: '10', offset: '0', q: 'x' }),
    ).not.toThrow();
  });

  it('allows extra facet keys', () => {
    expect(() =>
      assertOnlyKnownKosListQueryParams(
        { limit: '10', country_id: 'SG' },
        ['country_id'],
      ),
    ).not.toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() => assertOnlyKnownKosListQueryParams({ foo: 'bar' })).toThrow(AppError);
  });
});
