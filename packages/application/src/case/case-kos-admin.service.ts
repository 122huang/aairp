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

  async confirmCase(
    caseId: string,
    ctx?: AdminContext & {
      humanFeedback?: {
        decision?: CaseRecord['decision']['final_decision'];
        reviewer_id?: string;
        comment?: string;
        agreement_with_ai?: 'AGREE' | 'DISAGREE';
      };
    },
  ) {
    const latest = await this.requireLatest(caseId);
    const now = new Date().toISOString();
    let updated = await this.caseKosRepository.updateLifecycle(
      caseId,
      latest.case_version,
      'CONFIRMED',
      now,
    );

    if (ctx?.humanFeedback) {
      const current = await this.requireLatest(caseId);
      const withFeedback: CaseRecord = {
        ...current,
        human_feedback: {
          decision: ctx.humanFeedback.decision ?? current.decision.final_decision,
          reviewer_id: ctx.humanFeedback.reviewer_id,
          comment: ctx.humanFeedback.comment,
          agreement_with_ai: ctx.humanFeedback.agreement_with_ai,
          submitted_at: now,
        },
        updated_at: now,
      };
      await this.caseKosRepository.saveVersion(withFeedback);
      updated = (await this.caseKosRepository.findByCaseId(caseId)) ?? withFeedback;
    }

    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'PUBLISH',
      resourceType: 'case_record',
      resourceId: caseId,
      payload: {
        case_version: latest.case_version,
        lifecycle_status: 'CONFIRMED',
        human_feedback_written: Boolean(ctx?.humanFeedback),
      },
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
