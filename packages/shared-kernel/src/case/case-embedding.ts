import type { CaseRecord } from './case-record.js';
import type { ReviewContext } from '../context/review-context.js';

export const DEFAULT_CASE_EMBEDDING_MODEL = 'demo-hash-v1';
export const DEFAULT_CASE_EMBEDDING_DIMENSIONS = 128;

export type CaseEmbeddingRecord = {
  case_id: string;
  case_version: number;
  embedding_model: string;
  embedding: number[];
  embed_text: string;
  dimensions: number;
  created_at: string;
};

export type ICaseEmbeddingRepository = {
  upsert(record: CaseEmbeddingRecord): Promise<void>;
  findByCaseId(caseId: string, embeddingModel: string): Promise<CaseEmbeddingRecord | null>;
  findByCaseIds(caseIds: string[], embeddingModel: string): Promise<CaseEmbeddingRecord[]>;
};

export type IEmbeddingProvider = {
  readonly modelId: string;
  readonly dimensions: number;
  embed(text: string): number[];
};

export function buildCaseEmbedText(record: CaseRecord): string {
  return [
    `country=${record.dimensions.country_id}`,
    `category=${record.dimensions.category_id}`,
    `platform=${record.dimensions.platform_id}`,
    `lang=${record.advertisement.content.language ?? ''}`,
    `ad_type=${record.advertisement.ad_type}`,
    `content=${record.advertisement.content.text}`,
    `ocr=${record.advertisement.content.ocr_text ?? ''}`,
    `disclaimer=${record.advertisement.content.disclaimer_text ?? ''}`,
    `decision=${record.decision.ai_decision}`,
    `rules=${record.matched_rules.map((finding) => finding.ref_id).join(',')}`,
    `playbooks=${record.matched_playbooks.map((finding) => finding.ref_id).join(',')}`,
  ].join('\n');
}

export function buildReviewContextEmbedText(
  context: ReviewContext,
  ruleRefIds: string[] = [],
  playbookRefIds: string[] = [],
): string {
  return [
    `country=${context.dimensions.countryId}`,
    `category=${context.dimensions.categoryId}`,
    `platform=${context.dimensions.platformId}`,
    `content=${context.normalizedContent.text ?? ''}`,
    `ocr=${context.normalizedContent.ocrText ?? ''}`,
    `disclaimer=${context.normalizedContent.disclaimerText ?? ''}`,
    `rules=${ruleRefIds.join(',')}`,
    `playbooks=${playbookRefIds.join(',')}`,
  ].join('\n');
}

export function l2Normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function resolveCaseEmbeddingModel(): string {
  return process.env.AAIRP_CASE_EMBEDDING_MODEL ?? DEFAULT_CASE_EMBEDDING_MODEL;
}

export function isCaseVectorRetrievalEnabled(): boolean {
  if (process.env.AAIRP_CASE_FIRST_ENABLED === undefined) {
    return false;
  }
  const caseFirst =
    process.env.AAIRP_CASE_FIRST_ENABLED !== '0' &&
    process.env.AAIRP_CASE_FIRST_ENABLED.toLowerCase() !== 'false';
  if (!caseFirst) {
    return false;
  }
  const flag = process.env.AAIRP_CASE_VECTOR_RETRIEVAL;
  if (flag === undefined) {
    return false;
  }
  return flag !== '0' && flag.toLowerCase() !== 'false';
}

export function computeHybridRetrievalScore(params: {
  semanticScore: number;
  facetScore: number;
  ruleOverlapScore: number;
}): number {
  return Math.min(
    1,
    0.6 * params.semanticScore + 0.2 * params.ruleOverlapScore + 0.2 * params.facetScore,
  );
}
