import type {
  CaseRecord,
  CaseSaveResult,
  ICaseStore,
} from '@aairp/shared-kernel';

export type DualWriteCaseStoreLogFn = (message: string, context?: Record<string, unknown>) => void;

export type DualWriteCaseStoreConfig = {
  primary: ICaseStore;
  secondary: ICaseStore;
  log?: DualWriteCaseStoreLogFn;
};

export class DualWriteCaseStore implements ICaseStore {
  constructor(private readonly config: DualWriteCaseStoreConfig) {}

  async save(record: CaseRecord): Promise<CaseSaveResult> {
    const result = await this.config.primary.save(record);
    await this.writeSecondary(() => this.config.secondary.save(record), {
      review_id: record.review_id,
      case_id: record.case_id,
    });
    return result;
  }

  findByCaseId(caseId: string) {
    return this.config.primary.findByCaseId(caseId);
  }

  findByReviewId(reviewId: string) {
    return this.config.primary.findByReviewId(reviewId);
  }

  search(filters: Parameters<ICaseStore['search']>[0]) {
    return this.config.primary.search(filters);
  }

  listManifest() {
    return this.config.primary.listManifest();
  }

  exportAll() {
    return this.config.primary.exportAll();
  }

  private async writeSecondary(
    operation: () => Promise<unknown>,
    context: Record<string, unknown>,
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.config.log?.('case dual-write secondary failed', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
