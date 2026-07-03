import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReviewContext } from '@aairp/shared-kernel';
import type { RiskRewriteStrategy } from '../knowledge/risk-rewrite-router.js';

export type RewritePromptInput = {
  context: ReviewContext;
  locale: 'zh' | 'en';
  riskType: string;
  rewriteStrategy: RiskRewriteStrategy;
  rewriteTemplateId: string;
  findingRefId: string;
  findingSummary: string;
  originalSpan: string;
};

const defaultPromptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/rewrite.prompt.txt',
);

export const DEMO_REWRITE_PROMPT_PACK_VERSION = 'demo-rewrite-1.0.0';

export function resolveRewritePromptPath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.AAIRP_REWRITE_PROMPT_PATH) {
    return process.env.AAIRP_REWRITE_PROMPT_PATH;
  }
  return defaultPromptPath;
}

export function loadRewritePromptTemplate(customPath?: string): string {
  return readFileSync(resolveRewritePromptPath(customPath), 'utf8');
}

export function renderRewritePrompt(template: string, input: RewritePromptInput): string {
  const { context } = input;
  return template
    .replaceAll('{ad_text}', context.normalizedContent.text)
    .replaceAll('{country_id}', context.dimensions.countryId)
    .replaceAll('{platform_id}', context.dimensions.platformId)
    .replaceAll('{category_id}', context.dimensions.categoryId)
    .replaceAll('{locale}', input.locale)
    .replaceAll('{risk_type}', input.riskType)
    .replaceAll('{rewrite_strategy}', input.rewriteStrategy)
    .replaceAll('{rewrite_template_id}', input.rewriteTemplateId)
    .replaceAll('{finding_ref_id}', input.findingRefId)
    .replaceAll('{finding_summary}', input.findingSummary)
    .replaceAll('{original_span}', input.originalSpan);
}
