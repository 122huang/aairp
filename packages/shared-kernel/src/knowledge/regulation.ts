import type { PackVersionStatus, PaginationParams, PaginatedResult } from './common.js';

export type Regulation = {
  regulationId: string;
  regulationKey: string;
  jurisdiction: string;
  createdAt: string;
  updatedAt: string;
};

export type RegulationVersion = {
  regulationVersionId: string;
  regulationId: string;
  versionNumber: number;
  status: PackVersionStatus;
  lawName: string;
  article?: string;
  sourceUrl?: string;
  bodyText?: string;
  tags: string[];
  searchText?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RegulationExportBundle = {
  regulation_key: string;
  jurisdiction: string;
  regulation_id: string;
  published_version: RegulationVersion | null;
  versions: RegulationVersion[];
};

export type CreateRegulationInput = {
  regulationKey: string;
  jurisdiction: string;
};

export type CreateRegulationVersionInput = {
  regulationId: string;
  lawName: string;
  article?: string;
  sourceUrl?: string;
  bodyText?: string;
  tags?: string[];
  searchText?: string;
};

export type UpdateRegulationVersionInput = {
  lawName?: string;
  article?: string;
  sourceUrl?: string;
  bodyText?: string;
  tags?: string[];
  searchText?: string;
};

export type IRegulationRepository = {
  listRegulations(
    params: PaginationParams & { jurisdiction?: string; q?: string },
  ): Promise<PaginatedResult<Regulation>>;
  createRegulation(input: CreateRegulationInput): Promise<Regulation>;
  getRegulationById(regulationId: string): Promise<Regulation | null>;
  getRegulationByKey(regulationKey: string): Promise<Regulation | null>;
  listVersions(regulationId: string, status?: PackVersionStatus): Promise<RegulationVersion[]>;
  getVersionById(regulationVersionId: string): Promise<RegulationVersion | null>;
  createVersion(input: CreateRegulationVersionInput): Promise<RegulationVersion>;
  updateVersion(
    regulationVersionId: string,
    input: UpdateRegulationVersionInput,
  ): Promise<RegulationVersion>;
  linkRuleVersion(ruleVersionId: string, regulationVersionId: string): Promise<void>;
};
