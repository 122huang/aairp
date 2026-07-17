import type { CaseRecord, ICaseStore } from '@aairp/shared-kernel';
import type { ReviewHappyPathRunResult } from '../review/review-happy-path.service.js';
import { CaseBuilderService, DEFAULT_CASE_REVIEWER_ID } from './case-builder.service.js';
import { isCaseLibraryEnabled } from './case-paths.js';

export type CaseRecorderLogFn = (message: string, context?: Record<string, unknown>) => void;

export type CaseRecorderServiceDeps = {
  caseBuilderService: CaseBuilderService;
  caseStore: ICaseStore;
  enabled?: boolean;
  log?: CaseRecorderLogFn;
};

export type CaseRecordOptions = {
  /** When set and parent exists, new case inherits thread_id and sets parent_case_id. */
  parent_case_id?: string;
};

export class CaseRecorderService {
  private readonly enabled: boolean;

  constructor(private readonly deps: CaseRecorderServiceDeps) {
    this.enabled = deps.enabled ?? isCaseLibraryEnabled();
  }

  /** Fire-and-forget safe wrapper — never throws. */
  recordSafely(result: ReviewHappyPathRunResult, options: CaseRecordOptions = {}): void {
    void this.record(result, options).catch((error) => {
      this.deps.log?.('case library save failed', {
        review_id: result.reviewId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Builds and saves a CaseRecord. Returns the saved record (or existing one for the
   * same review_id). Returns null when the case library is disabled.
   */
  async record(
    result: ReviewHappyPathRunResult,
    options: CaseRecordOptions = {},
  ): Promise<CaseRecord | null> {
    if (!this.enabled) {
      return null;
    }

    const existing = await this.deps.caseStore.findByReviewId(result.reviewId);
    if (existing) {
      return existing;
    }

    let parentCaseId: string | undefined;
    let inheritedThreadId: string | undefined;
    const requestedParent = options.parent_case_id?.trim();
    if (requestedParent) {
      const parent = await this.deps.caseStore.findByCaseId(requestedParent);
      if (parent) {
        parentCaseId = parent.case_id;
        inheritedThreadId = parent.thread_id?.trim() || parent.case_id;
      }
      // Missing parent → treat as root (no parent_case_id / inherited thread).
    }

    const caseRecord = this.deps.caseBuilderService.build({
      ...result,
      threadLink: {
        ...(parentCaseId ? { parent_case_id: parentCaseId } : {}),
        ...(inheritedThreadId ? { inherited_thread_id: inheritedThreadId } : {}),
        reviewer_id: DEFAULT_CASE_REVIEWER_ID,
      },
    });
    await this.deps.caseStore.save(caseRecord);
    return caseRecord;
  }
}
