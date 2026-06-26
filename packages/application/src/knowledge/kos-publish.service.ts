import type {
  IKosPublishRepository,
  KosPublishContext,
  KosPublishObjectType,
  KosPublishedVersion,
} from '@aairp/shared-kernel';

export class KosPublishService {
  constructor(private readonly publishRepository: IKosPublishRepository) {}

  publish(
    objectType: KosPublishObjectType,
    versionId: string,
    ctx?: KosPublishContext,
  ): Promise<KosPublishedVersion> {
    return this.publishRepository.publish(objectType, versionId, ctx);
  }

  rollback(
    objectType: KosPublishObjectType,
    versionId: string,
    ctx?: KosPublishContext,
  ): Promise<KosPublishedVersion> {
    return this.publishRepository.rollback(objectType, versionId, ctx);
  }
}
