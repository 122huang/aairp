import type { ReviewHappyPathRunResult } from '../review/review-happy-path.service.js';
import { CaseBuilderService } from './case-builder.service.js';
import type { ICaseStore } from '@aairp/shared-kernel';
import { isCaseLibraryEnabled } from './case-paths.js';

export type CaseRecorderLogFn = (message: string, context?: Record<string, unknown>) => void;

export type CaseRecorderServiceDeps = {
  caseBuilderService: CaseBuilderService;
  caseStore: ICaseStore;
  enabled?: boolean;
  log?: CaseRecorderLogFn;
};

export class CaseRecorderService {
  private readonly enabled: boolean;

  constructor(private readonly deps: CaseRecorderServiceDeps) {
    this.enabled = deps.enabled ?? isCaseLibraryEnabled();
  }

  /** Fire-and-forget safe wrapper — never throws. */
  recordSafely(result: ReviewHappyPathRunResult): void {
    void this.record(result).catch((error) => {
      this.deps.log?.('case library save failed', {
        review_id: result.reviewId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async record(result: ReviewHappyPathRunResult): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const existing = await this.deps.caseStore.findByReviewId(result.reviewId);
    if (existing) {
      return;
    }

    const caseRecord = this.deps.caseBuilderService.build(result);
    await this.deps.caseStore.save(caseRecord);
  }
}
