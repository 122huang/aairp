import type {
  PromptContentExport,
  PromptLintResult,
  PromptPack,
  PromptTemplate,
  PromptVersion,
} from '@aairp/shared-kernel';
import { toPromptContentMetadata } from '@aairp/shared-kernel';

export type PromptPackDto = {
  prompt_pack_id: string;
  pack_key: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type PromptTemplateDto = {
  template_id: string;
  prompt_pack_id: string;
  template_key: string;
  template_type: string;
  created_at: string;
  updated_at: string;
};

export type PromptVersionDto = {
  prompt_version_id: string;
  template_id: string;
  version_number: number;
  status: string;
  schema_version?: string;
  tags: string[];
  published_at?: string;
  created_at: string;
  updated_at: string;
  content_metadata: {
    content_length: number;
    line_count: number;
    byte_length: number;
  };
};

export type PromptLintResultDto = {
  valid: boolean;
  content_length: number;
  line_count: number;
  byte_length: number;
  issues: Array<{ code: string; message: string }>;
};

export function toPromptPackDto(pack: PromptPack): PromptPackDto {
  return {
    prompt_pack_id: pack.promptPackId,
    pack_key: pack.packKey,
    name: pack.name,
    description: pack.description,
    created_at: pack.createdAt,
    updated_at: pack.updatedAt,
  };
}

export function toPromptTemplateDto(template: PromptTemplate): PromptTemplateDto {
  return {
    template_id: template.templateId,
    prompt_pack_id: template.promptPackId,
    template_key: template.templateKey,
    template_type: template.templateType,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

export function toPromptVersionDto(version: PromptVersion): PromptVersionDto {
  return {
    prompt_version_id: version.promptVersionId,
    template_id: version.templateId,
    version_number: version.versionNumber,
    status: version.status,
    schema_version: version.schemaVersion,
    tags: version.tags,
    published_at: version.publishedAt,
    created_at: version.createdAt,
    updated_at: version.updatedAt,
    content_metadata: toPromptContentMetadata(version.content),
  };
}

export function toPromptLintResultDto(lint: PromptLintResult): PromptLintResultDto {
  return lint;
}

export function toPromptContentExportDto(exportBundle: PromptContentExport) {
  return exportBundle;
}
