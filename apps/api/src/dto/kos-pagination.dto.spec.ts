import { describe, expect, it } from 'vitest';
import { toPaginatedResponseDto } from './kos-pagination.dto.js';

describe('toPaginatedResponseDto', () => {
  it('maps paginated result without q', () => {
    expect(
      toPaginatedResponseDto({
        items: [{ id: '1' }],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    ).toEqual({
      items: [{ id: '1' }],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('echoes q when provided', () => {
    expect(
      toPaginatedResponseDto(
        { items: [], total: 0, limit: 10, offset: 5 },
        'cure',
      ),
    ).toEqual({
      items: [],
      total: 0,
      limit: 10,
      offset: 5,
      q: 'cure',
    });
  });
});
