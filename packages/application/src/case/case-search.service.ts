import type { CaseManifestEntry, CaseSearchFilters, ICaseStore } from '@aairp/shared-kernel';

export class CaseSearchService {
  constructor(private readonly caseStore: ICaseStore) {}

  search(filters: CaseSearchFilters): Promise<CaseManifestEntry[]> {
    return this.caseStore.search(filters);
  }

  listManifest(): Promise<CaseManifestEntry[]> {
    return this.caseStore.listManifest();
  }
}
