import type {
  CreatePromptPackInput,
  CreatePromptTemplateInput,
  CreatePromptVersionInput,
  IPromptRepository,
  PackVersionStatus,
  PaginationParams,
  PromptContentExport,
  PromptLintResult,
  UpdatePromptVersionInput,
} from '@aairp/shared-kernel';
import {
  assertValidPromptContent,
  lintPromptContent,
  toPromptContentMetadata,
} from '@aairp/shared-kernel';
import { AuditLogService } from './audit-log.service.js';
import type { KosPublishService } from './kos-publish.service.js';

export type AdminContext = {
  actor?: string;
  traceId?: string;
};

export class PromptAdminService {
  constructor(
    private readonly promptRepository: IPromptRepository,
    private readonly publishService: KosPublishService,
    private readonly auditLogService: AuditLogService,
  ) {}

  listPacks(params: PaginationParams, _ctx?: AdminContext) {
    return this.promptRepository.listPacks(params);
  }

  async createPack(input: CreatePromptPackInput, ctx?: AdminContext) {
    const pack = await this.promptRepository.createPack(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'prompt_pack',
      resourceId: pack.promptPackId,
      payload: { packKey: pack.packKey },
    });
    return pack;
  }

  getPack(promptPackId: string) {
    return this.promptRepository.getPackById(promptPackId);
  }

  listTemplates(promptPackId: string, params: PaginationParams) {
    return this.promptRepository.listTemplates(promptPackId, params);
  }

  getTemplate(templateId: string) {
    return this.promptRepository.getTemplateById(templateId);
  }

  async createTemplate(input: CreatePromptTemplateInput, ctx?: AdminContext) {
    const template = await this.promptRepository.createTemplate(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'prompt_template',
      resourceId: template.templateId,
      payload: { templateKey: template.templateKey, templateType: template.templateType },
    });
    return template;
  }

  listVersions(templateId: string, status?: PackVersionStatus) {
    return this.promptRepository.listVersions(templateId).then((versions) =>
      status ? versions.filter((version) => version.status === status) : versions,
    );
  }

  getVersion(promptVersionId: string) {
    return this.promptRepository.getVersionById(promptVersionId);
  }

  lintContent(content: string): PromptLintResult {
    return lintPromptContent(content);
  }

  async createVersion(input: CreatePromptVersionInput, ctx?: AdminContext) {
    assertValidPromptContent(input.content);
    const version = await this.promptRepository.createVersion(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'prompt_version',
      resourceId: version.promptVersionId,
      payload: {
        templateId: version.templateId,
        versionNumber: version.versionNumber,
        contentMetadata: toPromptContentMetadata(version.content),
      },
    });
    return version;
  }

  async updateVersion(
    promptVersionId: string,
    input: UpdatePromptVersionInput,
    ctx?: AdminContext,
  ) {
    if (input.content !== undefined) {
      assertValidPromptContent(input.content);
    }
    const version = await this.promptRepository.updateVersion(promptVersionId, input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'UPDATE',
      resourceType: 'prompt_version',
      resourceId: version.promptVersionId,
      payload: {
        templateId: version.templateId,
        versionNumber: version.versionNumber,
        contentMetadata: toPromptContentMetadata(version.content),
      },
    });
    return version;
  }

  async publishVersion(promptVersionId: string, ctx?: AdminContext) {
    await this.publishService.publish('prompt', promptVersionId, ctx);
    const version = await this.promptRepository.getVersionById(promptVersionId);
    if (!version) {
      throw new Error(`prompt version not found after publish: ${promptVersionId}`);
    }
    return version;
  }

  async rollbackVersion(promptVersionId: string, ctx?: AdminContext) {
    await this.publishService.rollback('prompt', promptVersionId, ctx);
    const version = await this.promptRepository.getVersionById(promptVersionId);
    if (!version) {
      throw new Error(`prompt version not found after rollback: ${promptVersionId}`);
    }
    return version;
  }

  getVersionContent(promptVersionId: string) {
    return this.promptRepository.getVersionContent(promptVersionId);
  }

  exportPublishedContent(templateId: string): Promise<PromptContentExport | null> {
    return this.promptRepository.exportPublishedContent(templateId);
  }
}
