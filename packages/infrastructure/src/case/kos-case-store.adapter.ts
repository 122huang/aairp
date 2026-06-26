import type {
  CaseManifestEntry,
  CaseRecord,
  CaseSaveResult,
  CaseSearchFilters,
  ICaseKosRepository,
  ICaseStore,
} from '@aairp/shared-kernel';

export class KosCaseStoreAdapter implements ICaseStore {
  constructor(private readonly repository: ICaseKosRepository) {}

  save(record: CaseRecord): Promise<CaseSaveResult> {
    return this.repository.save(record);
  }

  findByCaseId(caseId: string): Promise<CaseRecord | null> {
    return this.repository.findByCaseId(caseId);
  }

  findByReviewId(reviewId: string): Promise<CaseRecord | null> {
    return this.repository.findByReviewId(reviewId);
  }

  async search(filters: CaseSearchFilters): Promise<CaseManifestEntry[]> {
    const result = await this.repository.search(filters);
    return result.items;
  }

  listManifest(): Promise<CaseManifestEntry[]> {
    return this.repository.listLatestManifest();
  }

  exportAll(): Promise<CaseRecord[]> {
    return this.repository.exportAllLatest();
  }
}
