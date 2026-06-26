import type {
  CreateFeedbackInput,
  FeedbackSearchFilters,
  IFeedbackRepository,
  UpdateFeedbackInput,
} from '@aairp/shared-kernel';
import { validateFeedbackRatings } from '@aairp/shared-kernel';
import { AuditLogService } from './audit-log.service.js';

export type AdminContext = {
  actor?: string;
  traceId?: string;
};

export class FeedbackAdminService {
  constructor(
    private readonly feedbackRepository: IFeedbackRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  search(filters: FeedbackSearchFilters) {
    return this.feedbackRepository.search(filters);
  }

  getFeedback(feedbackId: string) {
    return this.feedbackRepository.findById(feedbackId);
  }

  async createFeedback(input: CreateFeedbackInput, ctx?: AdminContext) {
    if (input.ratings) {
      validateFeedbackRatings(input.ratings);
    }
    const record = await this.feedbackRepository.create(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'feedback',
      resourceId: record.feedbackId,
      payload: {
        caseId: record.caseId,
        reviewId: record.reviewId,
        pilotId: record.pilotId,
      },
    });
    return record;
  }

  async updateFeedback(input: UpdateFeedbackInput, ctx?: AdminContext) {
    if (input.ratings) {
      validateFeedbackRatings(input.ratings);
    }
    const record = await this.feedbackRepository.update(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'UPDATE',
      resourceType: 'feedback',
      resourceId: record.feedbackId,
      payload: {
        status: record.status,
        caseId: record.caseId,
        reviewId: record.reviewId,
        pilotId: record.pilotId,
      },
    });
    return record;
  }

  upsertByCaseId(input: CreateFeedbackInput, ctx?: AdminContext) {
    if (input.ratings) {
      validateFeedbackRatings(input.ratings);
    }
    return this.feedbackRepository.upsertByCaseId(input).then(async (result) => {
      await this.auditLogService.record({
        actor: ctx?.actor,
        traceId: ctx?.traceId,
        action: result.created ? 'CREATE' : 'UPDATE',
        resourceType: 'feedback',
        resourceId: result.record.feedbackId,
        payload: {
          caseId: result.record.caseId,
          pilotId: result.record.pilotId,
          import: true,
        },
      });
      return result;
    });
  }
}
