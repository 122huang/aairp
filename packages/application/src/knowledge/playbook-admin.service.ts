import type {
  CreatePlaybookPackInput,
  CreatePlaybookPatternInput,
  CreatePlaybookVersionInput,
  IPlaybookRepository,
  PackVersionStatus,
  PaginationParams,
  PlaybookMarkdownExport,
  UpdatePlaybookPatternInput,
} from '@aairp/shared-kernel';
import { AuditLogService } from './audit-log.service.js';
import type { KosPublishService } from './kos-publish.service.js';

export type AdminContext = {
  actor?: string;
  traceId?: string;
};

export class PlaybookAdminService {
  constructor(
    private readonly playbookRepository: IPlaybookRepository,
    private readonly publishService: KosPublishService,
    private readonly auditLogService: AuditLogService,
  ) {}

  listPacks(params: PaginationParams, _ctx?: AdminContext) {
    return this.playbookRepository.listPacks(params);
  }

  async createPack(input: CreatePlaybookPackInput, ctx?: AdminContext) {
    const pack = await this.playbookRepository.createPack(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'playbook_pack',
      resourceId: pack.playbookPackId,
      payload: { packKey: pack.packKey },
    });
    return pack;
  }

  getPack(playbookPackId: string) {
    return this.playbookRepository.getPackById(playbookPackId);
  }

  listVersions(playbookPackId: string, status?: PackVersionStatus) {
    return this.playbookRepository.listPackVersions(playbookPackId).then((versions) =>
      status ? versions.filter((version) => version.status === status) : versions,
    );
  }

  getVersion(playbookVersionId: string) {
    return this.playbookRepository.getVersionById(playbookVersionId);
  }

  async createVersion(input: CreatePlaybookVersionInput, ctx?: AdminContext) {
    const version = await this.playbookRepository.createVersion(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'playbook_version',
      resourceId: version.playbookVersionId,
      payload: {
        playbookPackId: version.playbookPackId,
        versionNumber: version.versionNumber,
      },
    });
    return version;
  }

  listPatterns(playbookVersionId: string) {
    return this.playbookRepository.listPatterns(playbookVersionId);
  }

  getPattern(patternId: string) {
    return this.playbookRepository.getPatternById(patternId);
  }

  async createPattern(input: CreatePlaybookPatternInput, ctx?: AdminContext) {
    const pattern = await this.playbookRepository.createPattern(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'playbook_pattern',
      resourceId: pattern.patternId,
      payload: { refId: pattern.refId, playbookVersionId: pattern.playbookVersionId },
    });
    return pattern;
  }

  async updatePattern(
    patternId: string,
    input: UpdatePlaybookPatternInput,
    ctx?: AdminContext,
  ) {
    const pattern = await this.playbookRepository.updatePattern(patternId, input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'UPDATE',
      resourceType: 'playbook_pattern',
      resourceId: pattern.patternId,
      payload: { refId: pattern.refId, playbookVersionId: pattern.playbookVersionId },
    });
    return pattern;
  }

  async publishVersion(playbookVersionId: string, ctx?: AdminContext) {
    await this.publishService.publish('playbook', playbookVersionId, ctx);
    const version = await this.playbookRepository.getVersionById(playbookVersionId);
    if (!version) {
      throw new Error(`playbook version not found after publish: ${playbookVersionId}`);
    }
    return version;
  }

  async rollbackVersion(playbookVersionId: string, ctx?: AdminContext) {
    await this.publishService.rollback('playbook', playbookVersionId, ctx);
    const version = await this.playbookRepository.getVersionById(playbookVersionId);
    if (!version) {
      throw new Error(`playbook version not found after rollback: ${playbookVersionId}`);
    }
    return version;
  }

  exportMarkdown(playbookPackId: string): Promise<PlaybookMarkdownExport | null> {
    return this.playbookRepository.exportMarkdown(playbookPackId);
  }
}
