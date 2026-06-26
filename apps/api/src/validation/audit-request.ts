import { AppError } from '@aairp/shared-kernel';
import type { AuditSearchFilters } from '@aairp/shared-kernel';

export function parseAuditSearchQuery(query: Record<string, unknown>): AuditSearchFilters {
  const filters: AuditSearchFilters = {};

  if (typeof query.resource_type === 'string') filters.resourceType = query.resource_type;
  if (typeof query.resource_id === 'string') filters.resourceId = query.resource_id;
  if (typeof query.action === 'string') filters.action = query.action;
  if (typeof query.trace_id === 'string') filters.traceId = query.trace_id;
  if (typeof query.from === 'string') filters.from = query.from;
  if (typeof query.to === 'string') filters.to = query.to;
  if (typeof query.limit === 'string') filters.limit = Number(query.limit);
  if (typeof query.offset === 'string') filters.offset = Number(query.offset);

  return filters;
}

export function parseAuditExportQuery(query: Record<string, unknown>): AuditSearchFilters {
  const filters = parseAuditSearchQuery(query);
  const format = typeof query.format === 'string' ? query.format : 'csv';
  if (format !== 'csv') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Only format=csv is supported');
  }
  return filters;
}
