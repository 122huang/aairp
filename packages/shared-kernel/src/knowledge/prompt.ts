import type { PackVersionStatus, PaginatedResult, PaginationParams } from './common.js';

export type PromptPack = {
  promptPackId: string;
  packKey: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type PromptTemplate = {
  templateId: string;
  promptPackId: string;
  templateKey: string;
  templateType: string;
  createdAt: string;
  updatedAt: string;
};

export type PromptVersion = {
  promptVersionId: string;
  templateId: string;
  versionNumber: number;
  status: PackVersionStatus;
  content: string;
  schemaVersion?: string;
  tags: string[];
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PromptContentMetadata = {
  content_length: number;
  line_count: number;
  byte_length: number;
};

export type PromptContentExport = {
  pack_key: string;
  template_key: string;
  template_type: string;
  schema_version?: string;
  content: string;
  metadata: PromptContentMetadata;
};

export type CreatePromptPackInput = {
  packKey: string;
  name: string;
  description?: string;
};

export type CreatePromptTemplateInput = {
  promptPackId: string;
  templateKey: string;
  templateType?: string;
};

export type CreatePromptVersionInput = {
  templateId: string;
  content: string;
  schemaVersion?: string;
  tags?: string[];
};

export type UpdatePromptVersionInput = {
  content?: string;
  schemaVersion?: string;
  tags?: string[];
};

export type IPromptRepository = {
  listPacks(params: PaginationParams): Promise<PaginatedResult<PromptPack>>;
  createPack(input: CreatePromptPackInput): Promise<PromptPack>;
  getPackById(promptPackId: string): Promise<PromptPack | null>;
  getPackByKey(packKey: string): Promise<PromptPack | null>;
  listTemplates(
    promptPackId: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<PromptTemplate>>;
  createTemplate(input: CreatePromptTemplateInput): Promise<PromptTemplate>;
  getTemplateById(templateId: string): Promise<PromptTemplate | null>;
  getTemplateByPackAndKey(promptPackId: string, templateKey: string): Promise<PromptTemplate | null>;
  listVersions(templateId: string): Promise<PromptVersion[]>;
  getVersionById(promptVersionId: string): Promise<PromptVersion | null>;
  createVersion(input: CreatePromptVersionInput): Promise<PromptVersion>;
  updateVersion(promptVersionId: string, input: UpdatePromptVersionInput): Promise<PromptVersion>;
  getVersionContent(promptVersionId: string): Promise<string | null>;
  exportPublishedContent(templateId: string): Promise<PromptContentExport | null>;
};
