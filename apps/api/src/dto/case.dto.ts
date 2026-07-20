import type { CaseManifestEntry } from '@aairp/shared-kernel';

export type CaseManifestDto = {
  case_id: string;
  case_version: number;
  path: string;
  review_id: string;
  country_id: string;
  category_id: string;
  platform_id: string;
  language?: string;
  ai_decision: string;
  final_decision: string;
  lifecycle_status: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
  thread_id?: string;
  text_preview?: string;
};

export function toCaseManifestDto(entry: CaseManifestEntry): CaseManifestDto {
  return {
    case_id: entry.case_id,
    case_version: entry.case_version,
    path: entry.path,
    review_id: entry.review_id,
    country_id: entry.country_id,
    category_id: entry.category_id,
    platform_id: entry.platform_id,
    language: entry.language,
    ai_decision: entry.ai_decision,
    final_decision: entry.final_decision,
    lifecycle_status: entry.lifecycle_status,
    content_hash: entry.content_hash,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    ...(entry.thread_id ? { thread_id: entry.thread_id } : {}),
    ...(entry.text_preview ? { text_preview: entry.text_preview } : {}),
  };
}
