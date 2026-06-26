import type {
  PlaybookMarkdownExport,
  PlaybookPack,
  PlaybookPackVersion,
  PlaybookPattern,
} from '@aairp/shared-kernel';

export type PlaybookPackDto = {
  playbook_pack_id: string;
  pack_key: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type PlaybookVersionDto = {
  playbook_version_id: string;
  playbook_pack_id: string;
  version_number: number;
  status: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
};

export type PlaybookPatternDto = {
  pattern_id: string;
  playbook_version_id: string;
  ref_id: string;
  match_type: string;
  terms: string[];
  guidance?: string;
  markdown_body?: string;
  created_at: string;
  updated_at: string;
};

export function toPlaybookPackDto(pack: PlaybookPack): PlaybookPackDto {
  return {
    playbook_pack_id: pack.playbookPackId,
    pack_key: pack.packKey,
    name: pack.name,
    description: pack.description,
    created_at: pack.createdAt,
    updated_at: pack.updatedAt,
  };
}

export function toPlaybookVersionDto(version: PlaybookPackVersion): PlaybookVersionDto {
  return {
    playbook_version_id: version.playbookVersionId,
    playbook_pack_id: version.playbookPackId,
    version_number: version.versionNumber,
    status: version.status,
    published_at: version.publishedAt,
    created_at: version.createdAt,
    updated_at: version.updatedAt,
  };
}

export function toPlaybookPatternDto(pattern: PlaybookPattern): PlaybookPatternDto {
  return {
    pattern_id: pattern.patternId,
    playbook_version_id: pattern.playbookVersionId,
    ref_id: pattern.refId,
    match_type: pattern.matchType,
    terms: pattern.terms,
    guidance: pattern.guidance,
    markdown_body: pattern.markdownBody,
    created_at: pattern.createdAt,
    updated_at: pattern.updatedAt,
  };
}

export function toPlaybookMarkdownExportDto(exportBundle: PlaybookMarkdownExport) {
  return exportBundle;
}
