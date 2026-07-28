import { describe, expect, it } from 'vitest';
import type { AssetFieldExtract } from '@aairp/shared-kernel';
import { ConsistencyCompareService } from './consistency-compare.service.js';

describe('ConsistencyCompareService', () => {
  const service = new ConsistencyCompareService();

  it('flags cross-slice pressure conflicts deterministically', async () => {
    const fieldExtracts: AssetFieldExtract[] = [
      {
        sliceId: 'img0-s2-specs',
        sourceImageIndex: 0,
        sliceIndex: 2,
        quantitativeClaims: ['112kPa'],
        capacity: ['112kPa'],
      },
      {
        sliceId: 'img0-s5-comparison',
        sourceImageIndex: 0,
        sliceIndex: 5,
        quantitativeClaims: ['80kPa'],
        capacity: ['80kPa'],
      },
    ];

    const result = await service.compareWithOptionalLlmAssist({
      reviewId: 'rev_test',
      fieldExtracts,
    });
    expect(result.skipped).toBe(false);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]?.module).toBe('CONSISTENCY');
    expect(result.findings[0]?.evaluationDetail.slicesInvolved.length).toBeGreaterThanOrEqual(2);
  });

  it('skips when fewer than two slices are present', async () => {
    const result = await service.compareWithOptionalLlmAssist({
      reviewId: 'rev_single',
      fieldExtracts: [
        {
          sliceId: 'img0-s0-hero',
          sourceImageIndex: 0,
          sliceIndex: 0,
          capacity: ['5L'],
        },
      ],
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('SINGLE_SLICE');
  });
});
