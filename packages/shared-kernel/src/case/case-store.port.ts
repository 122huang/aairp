import type {
  CaseManifestEntry,
  CaseRecord,
  CaseSaveResult,
  CaseSearchFilters,
} from './case-record.js';

export type ICaseStore = {
  save(record: CaseRecord): Promise<CaseSaveResult>;
  findByCaseId(caseId: string): Promise<CaseRecord | null>;
  findByReviewId(reviewId: string): Promise<CaseRecord | null>;
  search(filters: CaseSearchFilters): Promise<CaseManifestEntry[]>;
  listManifest(): Promise<CaseManifestEntry[]>;
  exportAll(): Promise<CaseRecord[]>;
};
