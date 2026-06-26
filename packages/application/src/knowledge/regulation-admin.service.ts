import type {
  CreateRegulationInput,
  CreateRegulationVersionInput,
  IRegulationRepository,
  PackVersionStatus,
  PaginationParams,
  RegulationExportBundle,
  UpdateRegulationVersionInput,
} from '@aairp/shared-kernel';
import { AuditLogService } from './audit-log.service.js';
import type { KosPublishService } from './kos-publish.service.js';

export type AdminContext = {
  actor?: string;
  traceId?: string;
};

export class RegulationAdminService {
  constructor(
    private readonly regulationRepository: IRegulationRepository,
    private readonly publishService: KosPublishService,
    private readonly auditLogService: AuditLogService,
  ) {}

  listRegulations(params: PaginationParams & { jurisdiction?: string; q?: string }) {
    return this.regulationRepository.listRegulations(params);
  }

  async createRegulation(input: CreateRegulationInput, ctx?: AdminContext) {
    const regulation = await this.regulationRepository.createRegulation(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'regulation',
      resourceId: regulation.regulationId,
      payload: {
        regulationKey: regulation.regulationKey,
        jurisdiction: regulation.jurisdiction,
      },
    });
    return regulation;
  }

  getRegulation(regulationId: string) {
    return this.regulationRepository.getRegulationById(regulationId);
  }

  listVersions(regulationId: string, status?: PackVersionStatus) {
    return this.regulationRepository.listVersions(regulationId, status);
  }

  getVersion(regulationVersionId: string) {
    return this.regulationRepository.getVersionById(regulationVersionId);
  }

  async createVersion(input: CreateRegulationVersionInput, ctx?: AdminContext) {
    const version = await this.regulationRepository.createVersion(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'regulation_version',
      resourceId: version.regulationVersionId,
      payload: {
        regulationId: version.regulationId,
        versionNumber: version.versionNumber,
        lawName: version.lawName,
      },
    });
    return version;
  }

  async updateVersion(
    regulationVersionId: string,
    input: UpdateRegulationVersionInput,
    ctx?: AdminContext,
  ) {
    const version = await this.regulationRepository.updateVersion(regulationVersionId, input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'UPDATE',
      resourceType: 'regulation_version',
      resourceId: version.regulationVersionId,
      payload: { regulationId: version.regulationId, versionNumber: version.versionNumber },
    });
    return version;
  }

  async publishVersion(regulationVersionId: string, ctx?: AdminContext) {
    await this.publishService.publish('regulation', regulationVersionId, ctx);
    const version = await this.regulationRepository.getVersionById(regulationVersionId);
    if (!version) {
      throw new Error(`regulation version not found after publish: ${regulationVersionId}`);
    }
    return version;
  }

  async rollbackVersion(regulationVersionId: string, ctx?: AdminContext) {
    await this.publishService.rollback('regulation', regulationVersionId, ctx);
    const version = await this.regulationRepository.getVersionById(regulationVersionId);
    if (!version) {
      throw new Error(`regulation version not found after rollback: ${regulationVersionId}`);
    }
    return version;
  }

  async exportBundle(regulationId: string): Promise<RegulationExportBundle | null> {
    const regulation = await this.regulationRepository.getRegulationById(regulationId);
    if (!regulation) {
      return null;
    }

    const versions = await this.regulationRepository.listVersions(regulationId);
    const publishedVersion =
      versions.find((version) => version.status === 'PUBLISHED') ?? null;

    return {
      regulation_key: regulation.regulationKey,
      jurisdiction: regulation.jurisdiction,
      regulation_id: regulation.regulationId,
      published_version: publishedVersion,
      versions,
    };
  }
}
