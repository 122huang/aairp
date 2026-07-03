import type { KnowledgePreviewReport } from '@aairp/application';

export type KnowledgePreviewRequestDto = {
  claim_text: string;
  country?: string;
  category?: string;
  modality?: string;
};

export type KnowledgePreviewResponseDto = KnowledgePreviewReport;

export function toKnowledgePreviewResponseDto(
  report: KnowledgePreviewReport,
): KnowledgePreviewResponseDto {
  return report;
}
