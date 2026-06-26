import type { KosPublishedVersion } from '@aairp/shared-kernel';

export type KosPublishedVersionDto = {
  object_type: string;
  version_id: string;
  parent_id: string;
  version_number: number;
  status: string;
  published_at: string;
};

export function toKosPublishedVersionDto(
  version: KosPublishedVersion,
): KosPublishedVersionDto {
  return {
    object_type: version.objectType,
    version_id: version.versionId,
    parent_id: version.parentId,
    version_number: version.versionNumber,
    status: version.status,
    published_at: version.publishedAt,
  };
}
