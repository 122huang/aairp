import type {
  CaseKosSearchResult,
  CaseManifestEntry,
  CaseRecord,
  CaseSearchFilters,
  ICaseKosRepository,
} from '@aairp/shared-kernel';
import { AuditLogService } from '../knowledge/audit-log.service.js';

export type AdminContext = {
  actor?: string;
  traceId?: string;
};

export class CaseKosAdminService {
  constructor(
    private readonly caseKosRepository: ICaseKosRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  search(filters: CaseSearchFilters): Promise<CaseKosSearchResult> {
    return this.caseKosRepository.search(filters);
  }

  getCase(caseId: string, caseVersion?: number) {
    return this.caseKosRepository.findByCaseId(caseId, caseVersion);
  }

  listVersions(caseId: string): Promise<CaseManifestEntry[]> {
    return this.caseKosRepository.listVersions(caseId);
  }

  exportAllLatest(): Promise<CaseRecord[]> {
    return this.caseKosRepository.exportAllLatest();
  }

  async confirmCase(caseId: string, ctx?: AdminContext) {
    const latest = await this.requireLatest(caseId);
    const updated = await this.caseKosRepository.updateLifecycle(
      caseId,
      latest.case_version,
      'CONFIRMED',
      new Date().toISOString(),
    );
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'PUBLISH',
      resourceType: 'case_record',
      resourceId: caseId,
      payload: { case_version: latest.case_version, lifecycle_status: 'CONFIRMED' },
    });
    return updated;
  }

  async archiveCase(caseId: string, ctx?: AdminContext) {
    const latest = await this.requireLatest(caseId);
    const updated = await this.caseKosRepository.updateLifecycle(
      caseId,
      latest.case_version,
      'ARCHIVED',
      null,
    );
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'ARCHIVE',
      resourceType: 'case_record',
      resourceId: caseId,
      payload: { case_version: latest.case_version, lifecycle_status: 'ARCHIVED' },
    });
    return updated;
  }

  async rollbackCase(caseId: string, targetVersion: number, ctx?: AdminContext) {
    const restored = await this.caseKosRepository.rollbackToVersion(caseId, targetVersion);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'ROLLBACK',
      resourceType: 'case_record',
      resourceId: caseId,
      payload: {
        target_version: targetVersion,
        new_version: restored.case_version,
        lifecycle_status: restored.lifecycle_status,
      },
    });
    return restored;
  }

  async saveVersion(record: CaseRecord, ctx?: AdminContext) {
    await this.caseKosRepository.saveVersion(record);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'case_record',
      resourceId: record.case_id,
      payload: { case_version: record.case_version, amend: true },
    });
    const latest = await this.caseKosRepository.findByCaseId(record.case_id);
    if (!latest) {
      throw new Error(`case not found after amend: ${record.case_id}`);
    }
    return latest;
  }

  private async requireLatest(caseId: string): Promise<CaseRecord> {
    const latest = await this.caseKosRepository.findByCaseId(caseId);
    if (!latest) {
      throw new Error(`case not found: ${caseId}`);
    }
    return latest;
  }
}
