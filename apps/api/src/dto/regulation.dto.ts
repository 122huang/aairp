import type { Regulation, RegulationExportBundle, RegulationVersion } from '@aairp/shared-kernel';

export type RegulationDto = {
  regulation_id: string;
  regulation_key: string;
  jurisdiction: string;
  created_at: string;
  updated_at: string;
};

export type RegulationVersionDto = {
  regulation_version_id: string;
  regulation_id: string;
  version_number: number;
  status: string;
  law_name: string;
  article?: string;
  source_url?: string;
  body_text?: string;
  tags: string[];
  search_text?: string;
  effective_date?: string;
  mandatory?: boolean;
  risk_level?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
};

export function toRegulationDto(regulation: Regulation): RegulationDto {
  return {
    regulation_id: regulation.regulationId,
    regulation_key: regulation.regulationKey,
    jurisdiction: regulation.jurisdiction,
    created_at: regulation.createdAt,
    updated_at: regulation.updatedAt,
  };
}

export function toRegulationVersionDto(version: RegulationVersion): RegulationVersionDto {
  return {
    regulation_version_id: version.regulationVersionId,
    regulation_id: version.regulationId,
    version_number: version.versionNumber,
    status: version.status,
    law_name: version.lawName,
    article: version.article,
    source_url: version.sourceUrl,
    body_text: version.bodyText,
    tags: version.tags,
    search_text: version.searchText,
    effective_date: version.effectiveDate,
    mandatory: version.mandatory,
    risk_level: version.riskLevel,
    published_at: version.publishedAt,
    created_at: version.createdAt,
    updated_at: version.updatedAt,
  };
}

export function toRegulationExportDto(bundle: RegulationExportBundle) {
  return {
    regulation_key: bundle.regulation_key,
    jurisdiction: bundle.jurisdiction,
    regulation_id: bundle.regulation_id,
    published_version: bundle.published_version
      ? toRegulationVersionDto(bundle.published_version)
      : null,
    versions: bundle.versions.map(toRegulationVersionDto),
  };
}
