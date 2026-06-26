import { describe, expect, it, vi } from 'vitest';
import type { IKosPublishRepository } from '@aairp/shared-kernel';
import { KosPublishService } from './kos-publish.service.js';

describe('KosPublishService', () => {
  it('delegates publish to repository', async () => {
    const repository: IKosPublishRepository = {
      publish: vi.fn().mockResolvedValue({
        objectType: 'rule',
        versionId: 'rv-1',
        parentId: 'rule-1',
        versionNumber: 2,
        status: 'PUBLISHED',
        publishedAt: '2026-06-26T10:00:00.000Z',
      }),
      rollback: vi.fn(),
    };
    const service = new KosPublishService(repository);

    const result = await service.publish('rule', 'rv-1', { actor: 'legal@demo' });

    expect(repository.publish).toHaveBeenCalledWith('rule', 'rv-1', { actor: 'legal@demo' });
    expect(result.status).toBe('PUBLISHED');
  });

  it('delegates rollback to repository', async () => {
    const repository: IKosPublishRepository = {
      publish: vi.fn(),
      rollback: vi.fn().mockResolvedValue({
        objectType: 'rule',
        versionId: 'rv-old',
        parentId: 'rule-1',
        versionNumber: 1,
        status: 'PUBLISHED',
        publishedAt: '2026-06-26T11:00:00.000Z',
      }),
    };
    const service = new KosPublishService(repository);

    const result = await service.rollback('rule', 'rv-old', { traceId: 'trace-1' });

    expect(repository.rollback).toHaveBeenCalledWith('rule', 'rv-old', { traceId: 'trace-1' });
    expect(result.versionNumber).toBe(1);
  });
});
