import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ReviewContext, RuleFinding } from '@aairp/shared-kernel';
import { extractAnchors, normalize } from './semantic-shadow-engine.js';
import {
  invokeSemanticDescriptiveGateway,
  type SemanticDescriptiveGateway,
} from './semantic-descriptive-gateway.js';
import {
  SEMANTIC_SHADOW_NORMALIZER_VERSION,
  keyPresent,
  resolveSemanticShadowMode,
  semanticShadowDataApproved,
  shouldInvokeSemanticShadow,
} from './semantic-shadow-mode.js';

export type SemanticShadowFindingRef = {
  refId?: string;
  module?: string;
};

export type SemanticShadowSink = (event: Record<string, unknown>) => void | Promise<void>;

export type SemanticShadowGateway = SemanticDescriptiveGateway;

function defaultLogPath(): string {
  const fromEnv = process.env.AAIRP_SEMANTIC_SHADOW_LOG_DIR?.trim();
  if (fromEnv) {
    return join(fromEnv, 'shadow.jsonl');
  }
  return join(process.cwd(), 'data/semantic-shadow-logs/shadow.jsonl');
}

function fileSink(event: Record<string, unknown>): void {
  const path = defaultLogPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`);
}

function shadowFamily(prop: { predicate?: string } | null): string | null {
  if (prop?.predicate === 'nutrient_retention') return 'quantified_product_benefit';
  if (prop?.predicate === 'comparative_performance') return 'comparative_performance';
  if (prop?.predicate === 'measurable_specification') return 'bare_measurable_spec';
  return null;
}

export class SemanticShadowService {
  constructor(
    private readonly deps: {
      sink?: SemanticShadowSink;
      gateway?: SemanticShadowGateway;
      now?: () => number;
      random?: () => number;
    } = {},
  ) {}

  /**
   * Never throws to the caller. Never mutates findings. Authoritative review must not await this.
   */
  schedule(
    context: ReviewContext,
    authoritative: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
  ): void {
    try {
      if (!shouldInvokeSemanticShadow(process.env, this.deps.random ?? Math.random)) {
        return;
      }
      void this.runAndLog(context, authoritative).catch(() => undefined);
    } catch {
      return;
    }
  }

  async runAndLog(
    context: ReviewContext,
    authoritative: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
  ): Promise<Record<string, unknown>> {
    const started = (this.deps.now ?? Date.now)();
    const eventId = `shd_${randomUUID()}`;
    const mode = resolveSemanticShadowMode();
    const copy = context.normalizedContent.text ?? '';
    const country = context.dimensions.countryId;
    const category = context.dimensions.categoryId;
    const ruleRefs = authoritative.ruleFindings.map((finding) => finding.refId);
    const playbookRefs = authoritative.playbookFindings.map((finding) => finding.refId).filter(Boolean);
    const base = {
      shadow_event_id: eventId,
      correlation_id: context.reviewId,
      country,
      category,
      language: null,
      mode,
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      key: keyPresent() ? 'KEY_PRESENT' : 'KEY_ABSENT',
      normalizer_version: SEMANTIC_SHADOW_NORMALIZER_VERSION,
      authoritative_rule_refs: ruleRefs,
      authoritative_playbook_refs: playbookRefs,
    };
    try {
      return await this.execute(context, copy, country, category, base, started, authoritative);
    } catch {
      const event = {
        ...base,
        status: 'error',
        error: 'provider',
        latency_ms: (this.deps.now ?? Date.now)() - started,
      };
      await (this.deps.sink ?? fileSink)(event);
      return event;
    }
  }

  private async execute(
    context: ReviewContext,
    copy: string,
    country: string,
    category: string,
    base: Record<string, unknown>,
    started: number,
    _authoritative: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
  ): Promise<Record<string, unknown>> {
    void context;
    const ruleRefs = (base.authoritative_rule_refs as string[]) ?? [];
    const anchors = extractAnchors(copy);
    if (!semanticShadowDataApproved()) {
      const event = {
        ...base,
        status: 'blocked_data',
        latency_ms: (this.deps.now ?? Date.now)() - started,
      };
      await (this.deps.sink ?? fileSink)(event);
      return event;
    }
    if (!keyPresent()) {
      const event = {
        ...base,
        status: 'error',
        error: 'KEY_ABSENT',
        latency_ms: (this.deps.now ?? Date.now)() - started,
      };
      await (this.deps.sink ?? fileSink)(event);
      return event;
    }

    const timeoutMs = Number(process.env.AAIRP_SEMANTIC_SHADOW_TIMEOUT_MS ?? '8000');
    const gateway = this.deps.gateway ?? invokeSemanticDescriptiveGateway;
    const called = await gateway({
      copy,
      country,
      category,
      anchors,
      key: process.env.DEEPSEEK_API_KEY ?? '',
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 8000,
    });
    if (called.error) {
      const event = {
        ...base,
        status: 'error',
        error: called.error,
        latency_ms: (this.deps.now ?? Date.now)() - started,
      };
      await (this.deps.sink ?? fileSink)(event);
      return event;
    }

    const grounded: Array<Record<string, unknown>> = [];
    let hallucination = 0;
    for (const raw of called.propositions ?? []) {
      const record = raw as { primary_grounding_span?: string; material?: boolean };
      const span = record.primary_grounding_span;
      if (typeof span !== 'string' || !copy.includes(span)) {
        hallucination += 1;
        continue;
      }
      grounded.push(record);
    }
    const proposal = grounded.find((raw) => raw.material !== false) ?? null;
    const normalized = proposal
      ? normalize(copy, anchors, proposal)
      : { status: 'abstain', reason: 'NO_GROUNDED_PROPOSAL', proposition: null };
    const family =
      normalized.status === 'canonical'
        ? shadowFamily((normalized as { proposition?: { predicate?: string } }).proposition ?? null)
        : null;
    const ruleMissCandidate = Boolean(family) && ruleRefs.length === 0;
    const event = {
      ...base,
      status: normalized.status === 'canonical' ? 'success' : 'abstain',
      latency_ms: (this.deps.now ?? Date.now)() - started,
      grounding_hallucination_count: hallucination,
      shadow_finding_proposal: family,
      rule_miss_candidate: ruleMissCandidate ? 'SHADOW_RULE_MISS_CANDIDATE' : null,
      numeric_shadow_recovery: family ? 'NUMERIC_SHADOW_RECOVERY' : null,
      canonical_ir: normalized.status === 'canonical' ? (normalized as { proposition?: unknown }).proposition : null,
      consistency_conflicts:
        (normalized as { proposition?: { conflicts?: string[] }; conflicts?: string[] }).proposition?.conflicts ??
        (normalized as { conflicts?: string[] }).conflicts ??
        [],
      review_queue: family ? 'SHADOW_FINDING_REVIEW' : null,
    };
    await (this.deps.sink ?? fileSink)(event);
    return event;
  }
}
