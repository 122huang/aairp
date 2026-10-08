import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ReviewContext, RuleFinding } from '@aairp/shared-kernel';
import {
  invokeSemanticDescriptiveGateway,
  SEMANTIC_DESCRIPTIVE_MODEL,
  type SemanticDescriptiveGateway,
} from './semantic-descriptive-gateway.js';
import { extractAnchors, normalize } from './semantic-shadow-engine.js';
import {
  applyNumericAuthorityGate,
  buildSemanticNumericSupplementalFinding,
  existingNumericEquivalent,
} from './semantic-numeric-authority.js';
import {
  resolveSemanticNumericAuthorityMode,
  resolveSemanticNumericTimeoutMs,
  SEMANTIC_NUMERIC_NORMALIZER_VERSION,
  type SemanticNumericAuthorityMode,
} from './semantic-numeric-authority-mode.js';
import { keyPresent, semanticShadowDataApproved } from './semantic-shadow-mode.js';

export type NumericAuthoritySink = (event: Record<string, unknown>) => void | Promise<void>;

export type NumericAuthorityApplyResult = {
  mode: SemanticNumericAuthorityMode;
  findings: RuleFinding[];
  event: Record<string, unknown>;
};

function defaultLogPath(): string {
  const fromEnv = process.env.AAIRP_SEMANTIC_NUMERIC_LOG_DIR?.trim();
  if (fromEnv) {
    return join(fromEnv, 'numeric-authority.jsonl');
  }
  return join(process.cwd(), 'data/semantic-numeric-authority-logs/numeric-authority.jsonl');
}

function fileSink(event: Record<string, unknown>): void {
  const path = defaultLogPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`);
}

function stripSecrets(event: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(event);
  if (/sk-|api[_-]?key|authorization/i.test(json)) {
    return { ...event, redacted: true };
  }
  return event;
}

export class SemanticNumericAuthorityService {
  constructor(
    private readonly deps: {
      sink?: NumericAuthoritySink;
      gateway?: SemanticDescriptiveGateway;
      now?: () => number;
    } = {},
  ) {}

  async apply(
    context: ReviewContext,
    prior: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
  ): Promise<NumericAuthorityApplyResult> {
    const mode = resolveSemanticNumericAuthorityMode();
    const started = (this.deps.now ?? Date.now)();
    const traceId = randomUUID();
    const copy = context.normalizedContent.text ?? '';
    const base: Record<string, unknown> = {
      correlation_id: context.reviewId,
      semantic_trace_id: traceId,
      numeric_authority_mode: mode,
      country: context.dimensions.countryId,
      category: context.dimensions.categoryId,
      provider: 'deepseek',
      model: SEMANTIC_DESCRIPTIVE_MODEL,
      normalizer_version: SEMANTIC_NUMERIC_NORMALIZER_VERSION,
      rule_findings: prior.ruleFindings.map((finding) => finding.refId),
    };

    if (mode === 'off') {
      const event = { ...base, status: 'skipped_off', latency_ms: 0 };
      return { mode, findings: [], event };
    }

    const timeoutMs = resolveSemanticNumericTimeoutMs();
    const timed = await Promise.race([
      this.execute(context, prior, copy, base, started, timeoutMs),
      new Promise<NumericAuthorityApplyResult>((resolve) => {
        setTimeout(() => {
          const event = {
            ...base,
            status: 'timeout',
            authority_gate: 'ABSTAIN',
            reject_reason: 'TIMEOUT',
            supplemental_finding: false,
            evidence_handoff: false,
            latency_ms: (this.deps.now ?? Date.now)() - started,
            timeout_ms: timeoutMs,
          };
          resolve({ mode, findings: [], event });
        }, timeoutMs);
      }),
    ]);
    await (this.deps.sink ?? fileSink)(stripSecrets(timed.event));
    return timed;
  }

  private async execute(
    context: ReviewContext,
    prior: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
    copy: string,
    base: Record<string, unknown>,
    started: number,
    timeoutMs: number,
  ): Promise<NumericAuthorityApplyResult> {
    const mode = resolveSemanticNumericAuthorityMode();
    const finish = (event: Record<string, unknown>, findings: RuleFinding[] = []) => ({
      mode,
      findings,
      event: {
        ...event,
        latency_ms: (this.deps.now ?? Date.now)() - started,
      },
    });

    if (!semanticShadowDataApproved()) {
      return finish({ ...base, status: 'blocked_data', authority_gate: 'ABSTAIN', reject_reason: 'DATA_NOT_APPROVED' });
    }
    if (!keyPresent()) {
      return finish({ ...base, status: 'error', authority_gate: 'ABSTAIN', reject_reason: 'KEY_ABSENT' });
    }

    const anchors = extractAnchors(copy);
    const gateway = this.deps.gateway ?? invokeSemanticDescriptiveGateway;
    const called = await gateway({
      copy,
      country: context.dimensions.countryId,
      category: context.dimensions.categoryId,
      anchors,
      key: process.env.DEEPSEEK_API_KEY ?? '',
      timeoutMs,
    });
    if (called.error) {
      return finish({
        ...base,
        status: 'error',
        authority_gate: 'ABSTAIN',
        reject_reason: called.error,
      });
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
    const proposal =
      (grounded.find((raw) => raw.material !== false) as {
        material?: boolean;
        primary_grounding_span?: string;
      } | undefined) ?? null;
    const normalized = proposal
      ? normalize(copy, anchors, proposal)
      : { status: 'abstain', reason: 'NO_GROUNDED_PROPOSAL', proposition: null };
    const gate = applyNumericAuthorityGate({
      copy,
      anchors,
      proposal,
      normalized,
    });

    const canonical =
      normalized.status === 'canonical'
        ? (normalized as { proposition?: unknown }).proposition
        : null;
    const duplicate = existingNumericEquivalent(prior.ruleFindings, prior.playbookFindings);

    const eventCore = {
      ...base,
      grounding_hallucination_count: hallucination,
      canonical_ir: canonical,
      semantic_numeric_proposal: proposal,
      authority_gate: gate.pass ? 'PASS' : 'ABSTAIN',
      reject_reason: gate.pass ? (duplicate ? 'RULE_EQUIVALENT' : null) : gate.reason,
      source_provenance: duplicate
        ? 'RULE+SEMANTIC_NUMERIC'
        : gate.pass
          ? 'SEMANTIC_NUMERIC'
          : null,
    };

    if (!gate.pass) {
      return finish({
        ...eventCore,
        status: 'shadow_only',
        supplemental_finding: false,
        evidence_handoff: false,
      });
    }

    if (duplicate) {
      return finish({
        ...eventCore,
        status: 'deduplicated',
        supplemental_finding: false,
        evidence_handoff: false,
      });
    }

    if (mode !== 'on') {
      return finish({
        ...eventCore,
        status: 'shadow_eligible',
        supplemental_finding: false,
        evidence_handoff: false,
      });
    }

    const span = gate.proposition.primary_grounding_span ?? '';
    const finding = buildSemanticNumericSupplementalFinding({
      mapping: gate.mapping,
      copy,
      span,
    });
    return finish(
      {
        ...eventCore,
        status: 'authoritative_supplemental',
        supplemental_finding: true,
        evidence_handoff: gate.mapping.evidenceHandoff,
        supplemental_ref_id: finding.refId,
      },
      [finding],
    );
  }
}
