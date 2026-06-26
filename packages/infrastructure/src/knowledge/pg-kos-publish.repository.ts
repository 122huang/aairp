import type { DatabaseClient } from '../persistence/clients.js';
import type { TransactionRunner } from '../persistence/clients.js';
import type {
  IKosPublishRepository,
  KosPublishContext,
  KosPublishObjectType,
  KosPublishedVersion,
} from '@aairp/shared-kernel';
import { KosPublishError } from '@aairp/shared-kernel';
import { PgAuditLogRepository } from './pg-audit-log.repository.js';
import { toIso } from './pg-utils.js';

type VersionTableConfig = {
  objectType: KosPublishObjectType;
  table: string;
  versionIdColumn: string;
  parentIdColumn: string;
  versionNumberColumn: string;
  resourceType: string;
};

type VersionRow = Record<string, unknown> & {
  status: string;
};

const VERSION_TABLES: Record<KosPublishObjectType, VersionTableConfig> = {
  rule: {
    objectType: 'rule',
    table: 'app.rule_version',
    versionIdColumn: 'rule_version_id',
    parentIdColumn: 'rule_id',
    versionNumberColumn: 'version_number',
    resourceType: 'rule_version',
  },
  regulation: {
    objectType: 'regulation',
    table: 'app.regulation_version',
    versionIdColumn: 'regulation_version_id',
    parentIdColumn: 'regulation_id',
    versionNumberColumn: 'version_number',
    resourceType: 'regulation_version',
  },
  playbook: {
    objectType: 'playbook',
    table: 'app.playbook_pack_version',
    versionIdColumn: 'playbook_version_id',
    parentIdColumn: 'playbook_pack_id',
    versionNumberColumn: 'version_number',
    resourceType: 'playbook_version',
  },
  prompt: {
    objectType: 'prompt',
    table: 'app.prompt_version',
    versionIdColumn: 'prompt_version_id',
    parentIdColumn: 'template_id',
    versionNumberColumn: 'version_number',
    resourceType: 'prompt_version',
  },
};

function mapPublishedVersion(
  config: VersionTableConfig,
  row: VersionRow,
): KosPublishedVersion {
  return {
    objectType: config.objectType,
    versionId: row[config.versionIdColumn] as string,
    parentId: row[config.parentIdColumn] as string,
    versionNumber: row[config.versionNumberColumn] as number,
    status: 'PUBLISHED',
    publishedAt: toIso(row.published_at),
  };
}

export class PgKosPublishRepository implements IKosPublishRepository {
  constructor(
    private readonly db: TransactionRunner & DatabaseClient,
    private readonly auditLogRepository: PgAuditLogRepository,
  ) {}

  publish(
    objectType: KosPublishObjectType,
    versionId: string,
    ctx: KosPublishContext = {},
  ): Promise<KosPublishedVersion> {
    return this.db.withTransaction(async (tx) => {
      const config = VERSION_TABLES[objectType];
      const version = await this.lockVersion(tx, config, versionId);

      if (version.status !== 'DRAFT') {
        throw new KosPublishError(
          `only DRAFT versions can be published: ${versionId}`,
          'INVALID_STATE',
        );
      }

      await this.archivePublishedSiblings(tx, config, version, versionId);
      const published = await this.setPublished(tx, config, versionId);
      await this.auditLogRepository.record(
        {
          actor: ctx.actor,
          traceId: ctx.traceId,
          action: 'PUBLISH',
          resourceType: config.resourceType,
          resourceId: versionId,
          payload: {
            object_type: objectType,
            parent_id: published.parentId,
            version_number: published.versionNumber,
          },
        },
        tx,
      );

      return published;
    });
  }

  rollback(
    objectType: KosPublishObjectType,
    versionId: string,
    ctx: KosPublishContext = {},
  ): Promise<KosPublishedVersion> {
    return this.db.withTransaction(async (tx) => {
      const config = VERSION_TABLES[objectType];
      const version = await this.lockVersion(tx, config, versionId);

      if (version.status !== 'ARCHIVED') {
        throw new KosPublishError(
          `only ARCHIVED versions can be rolled back: ${versionId}`,
          'INVALID_STATE',
        );
      }

      await this.archivePublishedSiblings(tx, config, version, versionId);
      const published = await this.setPublished(tx, config, versionId);
      await this.auditLogRepository.record(
        {
          actor: ctx.actor,
          traceId: ctx.traceId,
          action: 'ROLLBACK',
          resourceType: config.resourceType,
          resourceId: versionId,
          payload: {
            object_type: objectType,
            parent_id: published.parentId,
            version_number: published.versionNumber,
          },
        },
        tx,
      );

      return published;
    });
  }

  private async lockVersion(
    db: DatabaseClient,
    config: VersionTableConfig,
    versionId: string,
  ): Promise<VersionRow> {
    const rows = await db.query<VersionRow>(
      `SELECT * FROM ${config.table}
       WHERE ${config.versionIdColumn} = $1
       FOR UPDATE`,
      [versionId],
    );
    const row = rows.rows[0];
    if (!row) {
      throw new KosPublishError(`version not found: ${versionId}`, 'NOT_FOUND');
    }
    return row;
  }

  private async archivePublishedSiblings(
    db: DatabaseClient,
    config: VersionTableConfig,
    version: VersionRow,
    versionId: string,
  ): Promise<void> {
    await db.query(
      `UPDATE ${config.table}
       SET status = 'ARCHIVED', updated_at = NOW()
       WHERE ${config.parentIdColumn} = $1
         AND status = 'PUBLISHED'
         AND ${config.versionIdColumn} <> $2`,
      [version[config.parentIdColumn], versionId],
    );
  }

  private async setPublished(
    db: DatabaseClient,
    config: VersionTableConfig,
    versionId: string,
  ): Promise<KosPublishedVersion> {
    const rows = await db.query<VersionRow>(
      `UPDATE ${config.table}
       SET status = 'PUBLISHED', published_at = NOW(), updated_at = NOW()
       WHERE ${config.versionIdColumn} = $1
       RETURNING *`,
      [versionId],
    );
    const row = rows.rows[0];
    if (!row) {
      throw new KosPublishError(`version not found: ${versionId}`, 'NOT_FOUND');
    }
    return mapPublishedVersion(config, row);
  }
}
