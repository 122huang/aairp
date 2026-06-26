import { describe, expect, it } from 'vitest';
import { AppError } from '@aairp/shared-kernel';
import { parseAdvertisementIdRequest, parseJsonObjectBody } from './demo-request.js';

describe('demo-request', () => {
  it('parseAdvertisementIdRequest returns trimmed id', () => {
    expect(parseAdvertisementIdRequest({ advertisement_id: '  ad_test  ' })).toEqual({
      advertisement_id: 'ad_test',
    });
  });

  it('parseAdvertisementIdRequest rejects missing id', () => {
    expect(() => parseAdvertisementIdRequest({})).toThrow(AppError);
  });

  it('parseJsonObjectBody rejects non-object body', () => {
    expect(() => parseJsonObjectBody(null)).toThrow(AppError);
    expect(() => parseJsonObjectBody([])).toThrow(AppError);
  });
});
