import type {
  CaseLifecycleStatus,
  CaseManifestEntry,
  CaseRecord,
  CaseSaveResult,
  CaseSearchFilters,
} from './case-record.js';

export type CaseKosSearchResult = {
  items: CaseManifestEntry[];
  total: number;
  limit: number;
  offset: number;
};

export type ICaseKosRepository = {
  save(record: CaseRecord): Promise<CaseSaveResult>;
  saveVersion(record: CaseRecord): Promise<CaseSaveResult>;
  findByCaseId(caseId: string, caseVersion?: number): Promise<CaseRecord | null>;
  findByReviewId(reviewId: string): Promise<CaseRecord | null>;
  search(filters: CaseSearchFilters): Promise<CaseKosSearchResult>;
  listLatestManifest(): Promise<CaseManifestEntry[]>;
  listVersions(caseId: string): Promise<CaseManifestEntry[]>;
  exportAllLatest(): Promise<CaseRecord[]>;
  updateLifecycle(
    caseId: string,
    caseVersion: number,
    lifecycleStatus: CaseLifecycleStatus,
    publishedAt?: string | null,
  ): Promise<CaseRecord>;
  rollbackToVersion(caseId: string, targetVersion: number): Promise<CaseRecord>;
};
