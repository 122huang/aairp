import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CaseFinding,
  ContextualRewriteResult,
  LlmFinding,
  PlaybookFinding,
  ReviewContext,
  RewriteOriginalSpan,
  RewriteSuggestion,
  RuleFinding,
  VisionFinding,
} from '@aairp/shared-kernel';
import {
  buildRiskRewriteRouteIndex,
  buildRuleIdToRiskTypeIndex,
  loadRiskRewriteRoutes,
  resolveRewriteTemplateId,
  type RiskRewriteRoute,
} from '../knowledge/risk-rewrite-router.js';
import {
  loadRewritePromptTemplate,
  renderRewritePrompt,
} from './rewrite-prompt.service.js';
import { createDefaultRewriteLlmGateway, resolveRewriteLlmMode } from './rewrite-llm.gateway.js';
import { parseRewriteResponseContent } from './rewrite-response.parser.js';
import type { ILlmGateway } from './stub-llm.gateway.types.js';

export type ContextualRewriteLocale = 'zh' | 'en' | 'auto';

export type WarnFinding = RuleFinding | PlaybookFinding | LlmFinding | CaseFinding | VisionFinding;

export type ContextualRewriteInput = {
  reviewId: string;
  finding: WarnFinding;
  adText: string;
  context?: ReviewContext;
  locale?: ContextualRewriteLocale;
};

type StubVariant = {
  text: string;
  rationale: string;
};

type ContextualRewriteStubsDocument = {
  schema_version: string;
  stubs_version: string;
  stubs: Record<string, { zh: StubVariant[]; en: StubVariant[] }>;
};

export type ContextualRewriteServiceConfig = {
  routesPath?: string;
  stubsPath?: string;
  promptPath?: string;
  llmGateway?: ILlmGateway;
  readTextFile?: (path: string) => string;
  createSuggestionId?: () => string;
  mode?: 'off' | 'stub' | 'live';
};

const defaultStubsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge/contextual-rewrite-stubs.json',
);

const CJK_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

function isBlockerFinding(finding: WarnFinding): boolean {
  return finding.severity === 'BLOCKER' && finding.decision === 'FAIL';
}

function isWarnEligibleFinding(finding: WarnFinding): boolean {
  if (isBlockerFinding(finding)) {
    return false;
  }
  return finding.decision === 'WARN' || finding.decision === 'REVIEW' || finding.decision === 'CONDITIONAL';
}

export function resolveRiskTypeFromFinding(
  finding: WarnFinding,
  ruleIdToRiskType?: Map<string, string>,
): string | undefined {
  if (finding.module === 'LLM' || finding.module === 'VISION') {
    return finding.evaluationDetail?.riskType ?? finding.refId;
  }
  if (finding.module === 'RULE') {
    return ruleIdToRiskType?.get(finding.refId);
  }
  return ruleIdToRiskType?.get(finding.refId) ?? finding.refId;
}

export function extractOriginalSpan(
  finding: WarnFinding,
  adText: string,
): RewriteOriginalSpan | undefined {
  const matched = finding.evaluationDetail?.matchedSpans?.[0];
  if (matched) {
    return matched;
  }

  const llmSpan = finding.module === 'LLM' ? finding.evaluationDetail?.evidenceSpans?.[0] : undefined;
  if (llmSpan) {
    return {
      field: llmSpan.field,
      start: llmSpan.start,
      end: llmSpan.end,
      text: llmSpan.text,
    };
  }

  const visionSpan =
    finding.module === 'VISION' ? finding.evaluationDetail?.evidenceSpans?.[0] : undefined;
  if (visionSpan) {
    const text = visionSpan.text ?? visionSpan.regionDescription ?? '';
    return {
      field: visionSpan.field,
      start: visionSpan.sliceIndex ?? 0,
      end: (visionSpan.sliceIndex ?? 0) + Math.max(text.length, 1),
      text,
    };
  }

  const needle = finding.summary.slice(0, 48).trim();
  if (needle.length > 0) {
    const index = adText.toLowerCase().indexOf(needle.toLowerCase());
    if (index >= 0) {
      return {
        field: 'text',
        start: index,
        end: index + needle.length,
        text: adText.slice(index, index + needle.length),
      };
    }
  }

  if (adText.trim().length > 0) {
    return { field: 'text', start: 0, end: adText.length, text: adText };
  }

  return undefined;
}

function resolveLocale(
  locale: ContextualRewriteLocale | undefined,
  originalSpan: RewriteOriginalSpan,
  adText: string,
): 'zh' | 'en' {
  if (locale === 'zh' || locale === 'en') {
    return locale;
  }
  const probe = `${originalSpan.text} ${adText}`;
  return CJK_PATTERN.test(probe) ? 'zh' : 'en';
}

function applyTemplatePlaceholders(text: string, originalSpan: RewriteOriginalSpan): string {
  return text.replaceAll('{original_span}', originalSpan.text);
}

function buildSuggestion(
  input: {
    reviewId: string;
    finding: WarnFinding;
    riskType: string;
    rewriteTemplateId: string;
    originalSpan: RewriteOriginalSpan;
    suggestedText: string[];
    rationale: string;
    confidence: number;
  },
  createSuggestionId: () => string,
): RewriteSuggestion {
  return {
    suggestionId: `rs_${createSuggestionId()}`,
    findingId: input.finding.findingId,
    riskType: input.riskType,
    rewriteTemplateId: input.rewriteTemplateId,
    originalSpan: input.originalSpan,
    suggestedText: input.suggestedText,
    rationale: input.rationale,
    confidence: input.confidence,
  };
}

export class ContextualRewriteService {
  private readonly routes: Map<string, RiskRewriteRoute>;
  private readonly ruleIdToRiskType: Map<string, string>;
  private readonly stubs: ContextualRewriteStubsDocument;
  private readonly promptTemplate: string;

  constructor(private readonly config: ContextualRewriteServiceConfig = {}) {
    const readTextFile = this.config.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
    const routesDoc = loadRiskRewriteRoutes(this.config.routesPath);
    this.routes = buildRiskRewriteRouteIndex(routesDoc);
    this.ruleIdToRiskType = buildRuleIdToRiskTypeIndex(routesDoc);
    const stubsPath = this.config.stubsPath ?? defaultStubsPath;
    this.stubs = JSON.parse(readTextFile(stubsPath)) as ContextualRewriteStubsDocument;
    this.promptTemplate = loadRewritePromptTemplate(this.config.promptPath);
  }

  resolveMode(): 'off' | 'stub' | 'live' {
    return this.config.mode ?? resolveRewriteLlmMode();
  }

  async suggest(input: ContextualRewriteInput): Promise<ContextualRewriteResult> {
    const { reviewId, finding, adText } = input;
    const mode = this.resolveMode();

    if (mode === 'off') {
      return {
        reviewId,
        findingId: finding.findingId,
        riskType: resolveRiskTypeFromFinding(finding, this.ruleIdToRiskType) ?? '',
        skipped: true,
        skipReason: 'REWRITE_MODE_OFF',
      };
    }

    if (!isWarnEligibleFinding(finding)) {
      return {
        reviewId,
        findingId: finding.findingId,
        riskType: resolveRiskTypeFromFinding(finding, this.ruleIdToRiskType) ?? '',
        skipped: true,
        skipReason: 'BLOCKER_FINDING',
      };
    }

    const riskType = resolveRiskTypeFromFinding(finding, this.ruleIdToRiskType);
    if (!riskType) {
      return {
        reviewId,
        findingId: finding.findingId,
        riskType: '',
        skipped: true,
        skipReason: 'NO_WARN_ROUTE',
      };
    }

    const route = this.routes.get(riskType);
    const rewriteTemplateId = resolveRewriteTemplateId(riskType, this.routes);
    if (!rewriteTemplateId || !route) {
      return {
        reviewId,
        findingId: finding.findingId,
        riskType,
        skipped: true,
        skipReason: 'NO_WARN_ROUTE',
      };
    }

    const originalSpan = extractOriginalSpan(finding, adText);
    if (!originalSpan || originalSpan.text.trim().length === 0) {
      return {
        reviewId,
        findingId: finding.findingId,
        riskType,
        skipped: true,
        skipReason: 'NO_ORIGINAL_SPAN',
      };
    }

    const locale = resolveLocale(input.locale, originalSpan, adText);
    const createSuggestionId = this.config.createSuggestionId ?? randomUUID;

    if (mode === 'stub') {
      return this.suggestFromStub({
        reviewId,
        finding,
        riskType,
        rewriteTemplateId,
        originalSpan,
        locale,
        createSuggestionId,
      });
    }

    return this.suggestFromLive({
      reviewId,
      finding,
      adText,
      context: input.context,
      riskType,
      rewriteTemplateId,
      route,
      originalSpan,
      locale,
      createSuggestionId,
    });
  }

  private suggestFromStub(input: {
    reviewId: string;
    finding: WarnFinding;
    riskType: string;
    rewriteTemplateId: string;
    originalSpan: RewriteOriginalSpan;
    locale: 'zh' | 'en';
    createSuggestionId: () => string;
  }): ContextualRewriteResult {
    const stubEntry = this.stubs.stubs[input.riskType];
    const variants = stubEntry?.[input.locale] ?? stubEntry?.en ?? [];
    if (variants.length === 0) {
      return {
        reviewId: input.reviewId,
        findingId: input.finding.findingId,
        riskType: input.riskType,
        skipped: true,
        skipReason: 'NO_WARN_ROUTE',
      };
    }

    const picked = variants.slice(0, 3);
    const suggestion = buildSuggestion(
      {
        reviewId: input.reviewId,
        finding: input.finding,
        riskType: input.riskType,
        rewriteTemplateId: input.rewriteTemplateId,
        originalSpan: input.originalSpan,
        suggestedText: picked.map((variant) =>
          applyTemplatePlaceholders(variant.text, input.originalSpan),
        ),
        rationale: picked[0]!.rationale,
        confidence: 0.82,
      },
      input.createSuggestionId,
    );

    return {
      reviewId: input.reviewId,
      findingId: input.finding.findingId,
      riskType: input.riskType,
      suggestion,
      skipped: false,
    };
  }

  private async suggestFromLive(input: {
    reviewId: string;
    finding: WarnFinding;
    adText: string;
    context?: ReviewContext;
    riskType: string;
    rewriteTemplateId: string;
    route: RiskRewriteRoute;
    originalSpan: RewriteOriginalSpan;
    locale: 'zh' | 'en';
    createSuggestionId: () => string;
  }): Promise<ContextualRewriteResult> {
    if (!input.context) {
      throw new Error('ContextualRewriteService live mode requires ReviewContext on input');
    }

    const prompt = renderRewritePrompt(this.promptTemplate, {
      context: input.context,
      locale: input.locale,
      riskType: input.riskType,
      rewriteStrategy: input.route.strategy,
      rewriteTemplateId: input.rewriteTemplateId,
      findingRefId: input.finding.refId,
      findingSummary: input.finding.summary,
      originalSpan: input.originalSpan.text,
    });

    const gateway = this.config.llmGateway ?? createDefaultRewriteLlmGateway();
    const { content } = await gateway.complete(prompt);
    const payload = parseRewriteResponseContent(content);

    const suggestion = buildSuggestion(
      {
        reviewId: input.reviewId,
        finding: input.finding,
        riskType: input.riskType,
        rewriteTemplateId: input.rewriteTemplateId,
        originalSpan: input.originalSpan,
        suggestedText: payload.suggested_text,
        rationale: payload.rationale,
        confidence: payload.confidence,
      },
      input.createSuggestionId,
    );

    return {
      reviewId: input.reviewId,
      findingId: input.finding.findingId,
      riskType: input.riskType,
      suggestion,
      skipped: false,
    };
  }
}
