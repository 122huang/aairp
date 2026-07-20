import { AppError } from '@aairp/shared-kernel';
import type { CaseLifecycleStatus, CaseSearchFilters, FinalDecision } from '@aairp/shared-kernel';

export type CaseRollbackBody = {
  target_version: number;
};

export function parseCaseSearchQuery(query: Record<string, unknown>): CaseSearchFilters {
  const filters: CaseSearchFilters = {};

  if (typeof query.case_id === 'string' && query.case_id.trim()) {
    filters.case_id = query.case_id.trim();
  }
  if (typeof query.thread_id === 'string' && query.thread_id.trim()) {
    filters.thread_id = query.thread_id.trim();
  }
  if (typeof query.country_id === 'string') filters.country_id = query.country_id;
  if (typeof query.category_id === 'string') filters.category_id = query.category_id;
  if (typeof query.platform_id === 'string') filters.platform_id = query.platform_id;
  if (typeof query.language === 'string') filters.language = query.language;
  if (typeof query.ai_decision === 'string') {
    filters.ai_decision = query.ai_decision as FinalDecision;
  }
  if (typeof query.final_decision === 'string') {
    filters.final_decision = query.final_decision as FinalDecision;
  }
  if (typeof query.lifecycle_status === 'string') {
    filters.lifecycle_status = query.lifecycle_status as CaseLifecycleStatus;
  }
  if (typeof query.review_id === 'string') filters.review_id = query.review_id;
  if (typeof query.content_hash === 'string') filters.content_hash = query.content_hash;
  if (typeof query.created_from === 'string' && query.created_from.trim()) {
    filters.created_from = query.created_from.trim();
  }
  if (typeof query.created_to === 'string' && query.created_to.trim()) {
    filters.created_to = query.created_to.trim();
  }
  if (typeof query.limit === 'string') filters.limit = Number(query.limit);
  if (typeof query.offset === 'string') filters.offset = Number(query.offset);

  return filters;
}

export function parseCaseRollbackBody(body: unknown): CaseRollbackBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const targetVersion = (body as Record<string, unknown>).target_version;
  if (typeof targetVersion !== 'number' || !Number.isInteger(targetVersion) || targetVersion < 1) {
    throw new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      'Invalid field: target_version',
    );
  }
  return { target_version: targetVersion };
}

export { parseKosActorHeaders } from './regulation-request.js';
