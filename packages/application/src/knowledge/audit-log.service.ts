import type { AuditSearchFilters, IAuditLogRepository, RecordAuditEventInput } from '@aairp/shared-kernel';
import { AUDIT_EXPORT_MAX_ROWS, formatAuditEventsCsv } from './audit-export.js';

export class AuditLogService {
  constructor(private readonly auditLogRepository: IAuditLogRepository) {}

  record(input: RecordAuditEventInput) {
    return this.auditLogRepository.record(input);
  }

  search(filters: Parameters<IAuditLogRepository['search']>[0]) {
    return this.auditLogRepository.search(filters);
  }

  findById(auditEventId: string) {
    return this.auditLogRepository.findById(auditEventId);
  }

  async exportCsv(filters: AuditSearchFilters): Promise<string> {
    const result = await this.auditLogRepository.search({
      ...filters,
      limit: AUDIT_EXPORT_MAX_ROWS,
      offset: 0,
    });
    return formatAuditEventsCsv(result.items);
  }
}
