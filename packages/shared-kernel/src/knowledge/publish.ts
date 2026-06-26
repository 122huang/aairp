import type { PackVersionStatus } from './common.js';

export type KosPublishObjectType = 'rule' | 'regulation' | 'playbook' | 'prompt';

export type KosPublishContext = {
  actor?: string;
  traceId?: string;
};

export type KosPublishedVersion = {
  objectType: KosPublishObjectType;
  versionId: string;
  parentId: string;
  versionNumber: number;
  status: PackVersionStatus;
  publishedAt: string;
};

export class KosPublishError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'INVALID_STATE',
  ) {
    super(message);
    this.name = 'KosPublishError';
  }
}

export interface IKosPublishRepository {
  publish(
    objectType: KosPublishObjectType,
    versionId: string,
    ctx?: KosPublishContext,
  ): Promise<KosPublishedVersion>;
  rollback(
    objectType: KosPublishObjectType,
    versionId: string,
    ctx?: KosPublishContext,
  ): Promise<KosPublishedVersion>;
}
