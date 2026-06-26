import type { PackVersionStatus, PaginatedResult, PaginationParams } from './common.js';

export type PlaybookPack = {
  playbookPackId: string;
  packKey: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlaybookPackVersion = {
  playbookVersionId: string;
  playbookPackId: string;
  versionNumber: number;
  status: PackVersionStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlaybookPattern = {
  patternId: string;
  playbookVersionId: string;
  refId: string;
  matchType: string;
  terms: string[];
  guidance?: string;
  markdownBody?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatePlaybookPackInput = {
  packKey: string;
  name: string;
  description?: string;
};

export type CreatePlaybookVersionInput = {
  playbookPackId: string;
};

export type CreatePlaybookPatternInput = {
  playbookVersionId: string;
  refId: string;
  matchType?: string;
  terms: string[];
  guidance?: string;
  markdownBody?: string;
};

export type UpdatePlaybookPatternInput = {
  refId?: string;
  matchType?: string;
  terms?: string[];
  guidance?: string;
  markdownBody?: string;
};

export type PlaybookMarkdownExport = {
  pack_key: string;
  pack_version: string;
  title: string;
  markdown: string;
};

export type IPlaybookRepository = {
  listPacks(params: PaginationParams): Promise<PaginatedResult<PlaybookPack>>;
  createPack(input: CreatePlaybookPackInput): Promise<PlaybookPack>;
  getPackById(playbookPackId: string): Promise<PlaybookPack | null>;
  getPackByKey(packKey: string): Promise<PlaybookPack | null>;
  listPackVersions(playbookPackId: string): Promise<PlaybookPackVersion[]>;
  getVersionById(playbookVersionId: string): Promise<PlaybookPackVersion | null>;
  createVersion(input: CreatePlaybookVersionInput): Promise<PlaybookPackVersion>;
  listPatterns(playbookVersionId: string): Promise<PlaybookPattern[]>;
  getPatternById(patternId: string): Promise<PlaybookPattern | null>;
  createPattern(input: CreatePlaybookPatternInput): Promise<PlaybookPattern>;
  updatePattern(patternId: string, input: UpdatePlaybookPatternInput): Promise<PlaybookPattern>;
  exportMarkdown(playbookPackId: string): Promise<PlaybookMarkdownExport | null>;
};
