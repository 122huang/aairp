import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
  LlmFinding,
  LlmSuggestedAction,
  OpenRiskDiscoveryResult,
  PriorFindingsSummary,
  ReviewContext,
} from '@aairp/shared-kernel';
import {
  formatCasePrecedentsForPrompt,
  formatRegulationRefsForPrompt,
  isCaseSkipLlmOnExactHash,
} from '@aairp/shared-kernel';
import type { ILlmGateway } from './stub-llm.gateway.types.js';
import { LlmGatewayTimeoutError } from './llm-gateway.utils.js';
import { searchableFields } from './content-matching.js';
import { createDefaultOpenRiskLlmGateway } from './open-risk-llm.gateway.js';
import {
  parseOpenRiskResponseContent,
  type OpenRiskFindingPayload,
} from './open-risk-response.parser.js';

export type OpenRiskDiscoveryConfig = {
  promptPath?: string;
  promptTemplate?: string;
  promptPackVersion?: string;
  stubResponsePath?: string;
  llmGateway?: ILlmGateway;
  now?: () => Date;
  createFindingId?: () => string;
  readTextFile?: (path: string) => string;
};

type StubFindingPayload = OpenRiskFindingPayload & {
  suggested_action: LlmSuggestedAction | 'REJECT' | string;
};

const defaultPromptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/open-risk.prompt.txt',
);
const defaultStubResponsePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/open-risk.stub.json',
);

function summarizeRuleFindings(
  findings: PriorFindingsSummary['ruleFindings'],
): string {
  if (findings.length === 0) {
    return 'none';
  }
  return findings.map((finding) => `${finding.refId}:${finding.decision}:${finding.summary}`).join('; ');
}

function summarizePlaybookFindings(
  findings: PriorFindingsSummary['playbookFindings'],
): string {
  if (findings.length === 0) {
    return 'none';
  }
  return findings.map((finding) => `${finding.refId}:${finding.decision}:${finding.summary}`).join('; ');
}

export function renderOpenRiskPrompt(
  template: string,
  context: ReviewContext,
  prior: PriorFindingsSummary,
): string {
  const caseContext = prior.caseReviewContext;
  return template
    .replaceAll('{ad_text}', context.normalizedContent.text)
    .replaceAll('{country_id}', context.dimensions.countryId)
    .replaceAll('{platform_id}', context.dimensions.platformId)
    .replaceAll('{category_id}', context.dimensions.categoryId)
    .replaceAll('{rule_findings_summary}', summarizeRuleFindings(prior.ruleFindings))
    .replaceAll('{playbook_findings_summary}', summarizePlaybookFindings(prior.playbookFindings))
    .replaceAll('{case_precedents_summary}', formatCasePrecedentsForPrompt(caseContext))
    .replaceAll('{known_regulation_refs}', formatRegulationRefsForPrompt(caseContext))
    .replaceAll('{shared_rule_refs}', caseContext?.sharedRuleRefs.join(', ') || 'none');
}

/** Recall-only risk types: must never soft-pass as WARN. */
const RECALL_ONLY_RISK_TYPES = new Set([
  'aana-children-code-risk',
  'sensitive-content-flag',
]);

function mapSuggestedAction(
  action: StubFindingPayload['suggested_action'],
  riskType?: string,
): LlmSuggestedAction {
  if (riskType && RECALL_ONLY_RISK_TYPES.has(riskType)) {
    return 'MANUAL_REVIEW';
  }
  if (action === 'REJECT') {
    return 'MANUAL_REVIEW';
  }
  if (action === 'WARN' || action === 'MANUAL_REVIEW') {
    return action;
  }
  return 'MANUAL_REVIEW';
}

function mapFindingDecision(action: LlmSuggestedAction): LlmFinding['decision'] {
  return action === 'MANUAL_REVIEW' ? 'REVIEW' : 'WARN';
}

function mapSeverity(severity: StubFindingPayload['severity']): LlmFinding['severity'] {
  return severity;
}

function createLlmFinding(
  config: OpenRiskDiscoveryConfig,
  promptPackVersion: string,
  payload: StubFindingPayload,
): LlmFinding {
  const suggestedAction = mapSuggestedAction(payload.suggested_action, payload.risk_type);
  const findingId = `lf_${(config.createFindingId ?? randomUUID)()}`;

  return {
    module: 'LLM',
    findingId,
    severity: mapSeverity(payload.severity),
    decision: mapFindingDecision(suggestedAction),
    refType: 'LLM_RISK',
    refId: payload.risk_type,
    refVersionId: `${promptPackVersion}-${payload.risk_type}-v1`,
    summary: payload.description,
    confidence: payload.confidence,
    evaluationDetail: {
      riskType: payload.risk_type,
      suggestedAction,
      ...(payload.evidence_spans ? { evidenceSpans: payload.evidence_spans } : {}),
      ...(payload.related_modules_checked
        ? { relatedModulesChecked: payload.related_modules_checked }
        : {}),
      ...(payload.cited_case_ids ? { citedCaseIds: payload.cited_case_ids } : {}),
      ...(payload.cited_rule_refs ? { citedRuleRefs: payload.cited_rule_refs } : {}),
    },
  };
}

export { parseOpenRiskResponseContent, parseOpenRiskStubResponse } from './open-risk-response.parser.js';

function collectPriorRefIds(prior: PriorFindingsSummary): Set<string> {
  return new Set([
    ...prior.ruleFindings.map((finding) => finding.refId),
    ...prior.playbookFindings.map((finding) => finding.refId),
    ...(prior.caseFindings?.map((finding) => finding.refId) ?? []),
  ]);
}

function isDuplicateOfPriorModules(finding: LlmFinding, priorRefIds: Set<string>): boolean {
  if (priorRefIds.has(finding.refId)) {
    return true;
  }

  const relatedModules = finding.evaluationDetail?.relatedModulesChecked ?? [];
  if (relatedModules.length === 0) {
    return false;
  }

  return relatedModules.every((refId) => priorRefIds.has(refId));
}

function isEvidenceGroundedInContent(finding: LlmFinding, context: ReviewContext): boolean {
  const evidenceSpans = finding.evaluationDetail?.evidenceSpans;
  if (!evidenceSpans || evidenceSpans.length === 0) {
    return true;
  }

  const combinedText = searchableFields(context)
    .map((field) => field.value.toLowerCase())
    .join(' ');

  return evidenceSpans.some((span) => combinedText.includes(span.text.toLowerCase()));
}

function hasGroundingCitation(
  finding: LlmFinding,
  caseReviewContext?: PriorFindingsSummary['caseReviewContext'],
): boolean {
  const detail = finding.evaluationDetail;
  const hasEvidence = (detail?.evidenceSpans?.length ?? 0) > 0;
  const hasCaseCitation = (detail?.citedCaseIds?.length ?? 0) > 0;
  const hasRuleCitation = (detail?.citedRuleRefs?.length ?? 0) > 0;

  if (!caseReviewContext || caseReviewContext.coldStart) {
    return hasEvidence;
  }

  return hasEvidence || hasCaseCitation || hasRuleCitation;
}

function hasValidCaseCitations(
  finding: LlmFinding,
  knownCaseIds: Set<string>,
): boolean {
  const citedCaseIds = finding.evaluationDetail?.citedCaseIds ?? [];
  if (citedCaseIds.length === 0) {
    return true;
  }
  return citedCaseIds.every((caseId) => knownCaseIds.has(caseId));
}

function hasValidRuleCitations(
  finding: LlmFinding,
  knownRuleRefs: Set<string>,
): boolean {
  const citedRuleRefs = finding.evaluationDetail?.citedRuleRefs ?? [];
  if (citedRuleRefs.length === 0) {
    return true;
  }
  return citedRuleRefs.every((refId) => knownRuleRefs.has(refId));
}

export function applyOpenRiskGuardrails(
  findings: LlmFinding[],
  context: ReviewContext,
  prior: PriorFindingsSummary,
): LlmFinding[] {
  const priorRefIds = collectPriorRefIds(prior);
  const caseReviewContext = prior.caseReviewContext;
  const knownCaseIds = new Set(caseReviewContext?.caseIds ?? []);
  const knownRuleRefs = new Set([
    ...prior.ruleFindings.map((finding) => finding.refId),
    ...(caseReviewContext?.sharedRuleRefs ?? []),
  ]);

  return findings.filter(
    (finding) =>
      !isDuplicateOfPriorModules(finding, priorRefIds) &&
      isEvidenceGroundedInContent(finding, context) &&
      hasGroundingCitation(finding, caseReviewContext) &&
      hasValidCaseCitations(finding, knownCaseIds) &&
      hasValidRuleCitations(finding, knownRuleRefs),
  );
}

export class OpenRiskDiscoveryService {
  constructor(private readonly config: OpenRiskDiscoveryConfig = {}) {}

  async discover(
    context: ReviewContext,
    prior: PriorFindingsSummary,
  ): Promise<OpenRiskDiscoveryResult> {
    const evaluatedAt = (this.config.now ?? (() => new Date()))().toISOString();

    if (prior.hasBlocker) {
      return {
        reviewId: context.reviewId,
        promptPackVersion: this.config.promptPackVersion ?? 'demo-open-risk-1.2.0',
        findings: [],
        skipped: true,
        skipReason: 'HAS_BLOCKER',
        evaluatedAt,
      };
    }

    if (prior.caseReviewContext?.hasConfirmedExactMatch && isCaseSkipLlmOnExactHash()) {
      return {
        reviewId: context.reviewId,
        promptPackVersion: this.config.promptPackVersion ?? 'demo-open-risk-1.2.0',
        findings: [],
        skipped: true,
        skipReason: 'EXACT_HASH_PRECEDENT',
        evaluatedAt,
      };
    }

    const readTextFile = this.config.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
    const promptPath = this.config.promptPath ?? defaultPromptPath;
    const stubResponsePath = this.config.stubResponsePath ?? defaultStubResponsePath;
    const promptTemplate =
      this.config.promptTemplate ?? readTextFile(promptPath);
    const prompt = renderOpenRiskPrompt(promptTemplate, context, prior);

    const gateway =
      this.config.llmGateway ??
      createDefaultOpenRiskLlmGateway({
        stubResponsePath,
        readTextFile,
      });
    let completion;
    try {
      completion = await gateway.complete(prompt);
    } catch (error) {
      if (error instanceof LlmGatewayTimeoutError) {
        throw new Error(`open risk discovery failed: ${error.message}`);
      }
      throw error;
    }
    const stubPayload = parseOpenRiskResponseContent(completion.content);
    const promptPackVersion =
      stubPayload.prompt_pack_version ?? this.config.promptPackVersion ?? 'demo-open-risk-1.5.3';

    const findings = applyOpenRiskGuardrails(
      stubPayload.findings.map((finding) =>
        createLlmFinding(this.config, promptPackVersion, finding),
      ),
      context,
      prior,
    );

    return {
      reviewId: context.reviewId,
      promptPackVersion,
      ...(completion.model ? { model: completion.model } : {}),
      findings,
      skipped: false,
      evaluatedAt,
    };
  }
}
