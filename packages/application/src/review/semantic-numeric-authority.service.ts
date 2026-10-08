import { randomUUID } from 'node:crypto';
import type { ReviewContext, RuleFinding } from '@aairp/shared-kernel';
import { supportsEvidenceAttachment } from '@aairp/shared-kernel';
import {
  invokeSemanticDescriptiveGateway,
  SEMANTIC_DESCRIPTIVE_MODEL,
  type SemanticDescriptiveGateway,
} from './semantic-descriptive-gateway.js';
import { extractAnchors, normalize } from './semantic-shadow-engine.js';
import {
  applyNumericAuthorityGate,
  buildSemanticNumericSupplementalFinding,
  evaluateNumericEligibility,
  existingNumericEquivalent,
} from './semantic-numeric-authority.js';
import {
  consumeNumericShadowCap,
  resolveSemanticNumericAuthorityMode,
  resolveSemanticNumericTimeoutMs,
  SEMANTIC_NUMERIC_NORMALIZER_VERSION,
  type SemanticNumericAuthorityMode,
} from './semantic-numeric-authority-mode.js';
import { keyPresent, semanticShadowDataApproved } from './semantic-shadow-mode.js';

export const NUMERIC_SHADOW_EVENT_TYPE = 'semantic_numeric_shadow';
export const NUMERIC_AUTHORITY_EVENT_TYPE = 'semantic_numeric_authority';

export type NumericAuthoritySink = (event: Record<string, unknown>) => void | Promise<void>;

export type NumericAuthorityApplyResult = {
  mode: SemanticNumericAuthorityMode;
  findings: RuleFinding[];
  event: Record<string, unknown>;
};

function emitStructured(event: Record<string, unknown>, sink?: NumericAuthoritySink): void {
  const safe = stripSecrets(event);
  try {
    if (sink) {
      void Promise.resolve(sink(safe)).catch(() => undefined);
    } else {
      console.info(JSON.stringify(safe));
    }
  } catch {
    return;
  }
}

function stripSecrets(event: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(event);
  if (/sk-|api[_-]?key|authorization/i.test(json)) {
    return { ...event, redacted: true };
  }
  return event;
}

function anchorSummary(anchors: Array<{ kind?: string; span?: string; unit?: string }>): Array<{
  kind?: string;
  span?: string;
  unit?: string;
}> {
  return anchors.map((anchor) => ({
    kind: anchor.kind,
    ...(anchor.span ? { span: String(anchor.span).slice(0, 80) } : {}),
    ...(anchor.unit ? { unit: anchor.unit } : {}),
  }));
}

export class SemanticNumericAuthorityService {
  constructor(
    private readonly deps: {
      sink?: NumericAuthoritySink;
      gateway?: SemanticDescriptiveGateway;
      now?: () => number;
    } = {},
  ) {}

  /**
   * Non-blocking numeric shadow. Must not be awaited by the review pipeline.
   */
  scheduleShadow(
    context: ReviewContext,
    prior: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
  ): void {
    try {
      if (resolveSemanticNumericAuthorityMode() !== 'shadow') {
        return;
      }
      const snapshot = {
        ruleFindings: [...prior.ruleFindings],
        playbookFindings: [...prior.playbookFindings],
      };
      void this.runLane(context, snapshot, 'shadow').catch(() => undefined);
    } catch {
      return;
    }
  }

  /** Bounded await for mode=on only. Fail-open: never throw to the pipeline. */
  async applyAuthoritative(
    context: ReviewContext,
    prior: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
  ): Promise<NumericAuthorityApplyResult> {
    if (resolveSemanticNumericAuthorityMode() !== 'on') {
      return {
        mode: resolveSemanticNumericAuthorityMode(),
        findings: [],
        event: { event_type: NUMERIC_AUTHORITY_EVENT_TYPE, final_shadow_status: 'skipped_not_on' },
      };
    }
    try {
      return await this.runLane(context, prior, 'on');
    } catch {
      return {
        mode: 'on',
        findings: [],
        event: { event_type: NUMERIC_AUTHORITY_EVENT_TYPE, final_shadow_status: 'error' },
      };
    }
  }

  /** @deprecated Use applyAuthoritative. Kept for existing on-mode unit tests. */
  async apply(
    context: ReviewContext,
    prior: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
  ): Promise<NumericAuthorityApplyResult> {
    return this.applyAuthoritative(context, prior);
  }

  private async runLane(
    context: ReviewContext,
    prior: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
    lane: 'shadow' | 'on',
  ): Promise<NumericAuthorityApplyResult> {
    const started = (this.deps.now ?? Date.now)();
    const timeoutMs = resolveSemanticNumericTimeoutMs();
    const eventType = lane === 'shadow' ? NUMERIC_SHADOW_EVENT_TYPE : NUMERIC_AUTHORITY_EVENT_TYPE;
    const copy = context.normalizedContent.text ?? '';
    const base: Record<string, unknown> = {
      event_type: eventType,
      shadow_event_id: randomUUID(),
      correlation_id: context.reviewId,
      timestamp: new Date((this.deps.now ?? Date.now)()).toISOString(),
      numeric_authority_mode: lane,
      country: context.dimensions.countryId,
      category: context.dimensions.categoryId,
      language: context.normalizedContent.language ?? null,
      provider: 'deepseek',
      model: SEMANTIC_DESCRIPTIVE_MODEL,
      normalizer_version: SEMANTIC_NUMERIC_NORMALIZER_VERSION,
      rule_findings: prior.ruleFindings.map((finding) => finding.refId),
    };

    const finish = (event: Record<string, unknown>, findings: RuleFinding[] = []) => {
      const completed: NumericAuthorityApplyResult = {
        mode: lane,
        findings,
        event: {
          ...base,
          ...event,
          latency_ms: (this.deps.now ?? Date.now)() - started,
        },
      };
      emitStructured(completed.event, this.deps.sink);
      return completed;
    };

    const anchors = extractAnchors(copy) as Array<{ kind?: string; span?: string; unit?: string }>;
    const eligibility = evaluateNumericEligibility(anchors);
    if (!eligibility.eligible) {
      return finish({
        eligibility_result: 'ineligible',
        eligibility_reason: eligibility.reason,
        deterministic_anchors_summary: anchorSummary(anchors),
        provider_status: 'skipped',
        authority_gate_pass: false,
        authority_gate_fail_reasons: ['NO_NUMERIC_STRUCTURE_SIGNAL'],
        would_authorize_numeric_finding: false,
        would_enter_evidence_flow: false,
        would_be_supplemental: false,
        rule_equivalent_found: false,
        final_shadow_status: 'ineligible',
      });
    }

    if (lane === 'shadow' && !consumeNumericShadowCap()) {
      return finish({
        eligibility_result: 'eligible',
        eligibility_reason: eligibility.reason,
        deterministic_anchors_summary: anchorSummary(anchors),
        provider_status: 'skipped',
        authority_gate_pass: false,
        authority_gate_fail_reasons: ['SHADOW_CAP_REACHED'],
        would_authorize_numeric_finding: false,
        would_enter_evidence_flow: false,
        would_be_supplemental: false,
        rule_equivalent_found: false,
        final_shadow_status: 'shadow_cap_reached',
      });
    }

    if (!semanticShadowDataApproved()) {
      return finish({
        eligibility_result: 'eligible',
        provider_status: 'skipped',
        authority_gate_pass: false,
        authority_gate_fail_reasons: ['DATA_NOT_APPROVED'],
        would_authorize_numeric_finding: false,
        would_enter_evidence_flow: false,
        would_be_supplemental: false,
        final_shadow_status: 'blocked_data',
      });
    }
    if (!keyPresent()) {
      return finish({
        eligibility_result: 'eligible',
        provider_status: 'skipped',
        authority_gate_pass: false,
        authority_gate_fail_reasons: ['KEY_ABSENT'],
        would_authorize_numeric_finding: false,
        would_enter_evidence_flow: false,
        would_be_supplemental: false,
        final_shadow_status: 'error',
      });
    }

    const executed = await Promise.race([
      this.interpret(context, prior, copy, anchors, eligibility, started, timeoutMs, lane),
      new Promise<NumericAuthorityApplyResult>((resolve) => {
        setTimeout(() => {
          resolve({
            mode: lane,
            findings: [],
            event: {
              ...base,
              eligibility_result: 'eligible',
              provider_status: 'timeout',
              authority_gate_pass: false,
              authority_gate_fail_reasons: ['TIMEOUT'],
              would_authorize_numeric_finding: false,
              would_enter_evidence_flow: false,
              would_be_supplemental: false,
              final_shadow_status: lane === 'shadow' ? 'shadow_timeout' : 'timeout',
              latency_ms: (this.deps.now ?? Date.now)() - started,
              timeout_ms: timeoutMs,
            },
          });
        }, timeoutMs);
      }),
    ]);
    emitStructured(executed.event, this.deps.sink);
    return executed;
  }

  private async interpret(
    context: ReviewContext,
    prior: { ruleFindings: RuleFinding[]; playbookFindings: Array<{ refId?: string }> },
    copy: string,
    anchors: Array<{ kind?: string; span?: string; unit?: string }>,
    eligibility: { eligible: boolean; reason: string; anchor_kinds: string[] },
    started: number,
    timeoutMs: number,
    lane: 'shadow' | 'on',
  ): Promise<NumericAuthorityApplyResult> {
    const gateway = this.deps.gateway ?? invokeSemanticDescriptiveGateway;
    const called = await gateway({
      copy,
      country: context.dimensions.countryId,
      category: context.dimensions.categoryId,
      anchors,
      key: process.env.DEEPSEEK_API_KEY ?? '',
      timeoutMs,
    });

    const eventType = lane === 'shadow' ? NUMERIC_SHADOW_EVENT_TYPE : NUMERIC_AUTHORITY_EVENT_TYPE;
    const wrap = (event: Record<string, unknown>, findings: RuleFinding[] = []): NumericAuthorityApplyResult => ({
      mode: lane,
      findings,
      event: {
        event_type: eventType,
        correlation_id: context.reviewId,
        numeric_authority_mode: lane,
        country: context.dimensions.countryId,
        category: context.dimensions.categoryId,
        language: context.normalizedContent.language ?? null,
        provider: 'deepseek',
        model: SEMANTIC_DESCRIPTIVE_MODEL,
        normalizer_version: SEMANTIC_NUMERIC_NORMALIZER_VERSION,
        eligibility_result: 'eligible',
        eligibility_reason: eligibility.reason,
        deterministic_anchors_summary: anchorSummary(anchors),
        ...event,
        latency_ms: (this.deps.now ?? Date.now)() - started,
      },
    });

    if (called.error) {
      return wrap({
        provider_status: 'error',
        authority_gate_pass: false,
        authority_gate_fail_reasons: [called.error],
        would_authorize_numeric_finding: false,
        would_enter_evidence_flow: false,
        would_be_supplemental: false,
        final_shadow_status: 'provider_error',
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
    const duplicate = existingNumericEquivalent(prior.ruleFindings, prior.playbookFindings);
    const canonical =
      normalized.status === 'canonical'
        ? (normalized as { proposition?: unknown }).proposition
        : null;
    const wouldAuthorize = gate.pass;
    const wouldBeSupplemental = gate.pass && !duplicate;
    const wouldEnterEvidence = Boolean(
      wouldBeSupplemental &&
        gate.pass &&
        supportsEvidenceAttachment(gate.mapping.remediationType, 'WARN'),
    );

    const shared = {
      provider_status: 'success',
      grounding_hallucination_count: hallucination,
      semantic_proposal_summary: proposal
        ? {
            material: proposal.material,
            primary_grounding_span: proposal.primary_grounding_span,
          }
        : null,
      canonical_ir_summary: canonical,
      grounding_spans: proposal?.primary_grounding_span ? [proposal.primary_grounding_span] : [],
      consistency_conflicts:
        (normalized as { conflicts?: string[]; proposition?: { conflicts?: string[] } }).conflicts ??
        (normalized as { proposition?: { conflicts?: string[] } }).proposition?.conflicts ??
        [],
      authority_gate_pass: wouldAuthorize,
      authority_gate_fail_reasons: gate.pass ? [] : [gate.reason],
      would_authorize_numeric_finding: wouldAuthorize,
      would_enter_evidence_flow: wouldEnterEvidence,
      would_be_supplemental: wouldBeSupplemental,
      rule_equivalent_found: duplicate,
      source_provenance: duplicate
        ? 'RULE+SEMANTIC_NUMERIC'
        : wouldAuthorize
          ? 'SEMANTIC_NUMERIC'
          : null,
    };

    if (!gate.pass) {
      return wrap({
        ...shared,
        final_shadow_status: 'shadow_only',
      });
    }
    if (duplicate) {
      return wrap({
        ...shared,
        final_shadow_status: 'deduplicated',
      });
    }
    if (lane !== 'on') {
      return wrap({
        ...shared,
        final_shadow_status: 'would_authorize',
      });
    }

    const span = gate.proposition.primary_grounding_span ?? '';
    const finding = buildSemanticNumericSupplementalFinding({
      mapping: gate.mapping,
      copy,
      span,
    });
    return wrap(
      {
        ...shared,
        final_shadow_status: 'authoritative_supplemental',
        supplemental_ref_id: finding.refId,
      },
      [finding],
    );
  }
}
