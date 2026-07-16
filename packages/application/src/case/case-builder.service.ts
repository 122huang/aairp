import { randomUUID } from 'node:crypto';
import type {
  CaseEvidence,
  CaseMatchedFinding,
  CaseRecommendation,
  CaseRecord,
  CaseRegulationRef,
  ReviewCaseSnapshot,
} from '@aairp/shared-kernel';
import { CASE_SCHEMA_VERSION, isLegalReviewedMarket } from '@aairp/shared-kernel';
import type { ModuleFinding } from '@aairp/shared-kernel';
import type { ReviewDecisionResult } from '@aairp/shared-kernel';
import type { ReviewHappyPathResult } from '@aairp/shared-kernel';

export type CaseBuilderConfig = {
  pipelineVersion?: string;
  now?: () => Date;
  createCaseId?: () => string;
};

function resolveAdType(snapshot: ReviewCaseSnapshot): string {
  const ctx = snapshot.context.advertisementContext;
  return ctx.adType ?? ctx.adFormat ?? ctx.campaignType ?? 'UNKNOWN';
}

function mapFinding(finding: ModuleFinding): CaseMatchedFinding {
  return {
    finding_id: finding.findingId,
    ref_id: finding.refId,
    ref_version_id: finding.refVersionId,
    severity: finding.severity,
    decision: finding.decision,
    summary: finding.summary,
    confidence: finding.confidence,
    ...(finding.evaluationDetail ? { evaluation_detail: finding.evaluationDetail } : {}),
  };
}

type EvidenceDetail = {
  matchedSpans?: Array<{ field: string; start: number; end: number; text: string }>;
  evidenceSpans?: Array<{ field: string; start: number; end: number; text: string }>;
  citation?: { lawName: string; article?: string };
};

/** Collect text spans from Rule/Playbook matchedSpans and Open Risk evidenceSpans. */
function extractTextSpans(finding: ModuleFinding): Array<{
  field: string;
  start: number;
  end: number;
  text: string;
}> {
  const detail = finding.evaluationDetail as EvidenceDetail | undefined;
  const spans = [...(detail?.matchedSpans ?? []), ...(detail?.evidenceSpans ?? [])];
  const seen = new Set<string>();
  return spans.filter((span) => {
    const key = `${span.field}:${span.start}:${span.end}:${span.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildEvidence(snapshot: ReviewCaseSnapshot): CaseEvidence[] {
  const evidence: CaseEvidence[] = [];
  const allFindings = [
    ...snapshot.ruleResult.findings.map((f) => ({ finding: f, module: 'RULE' as const })),
    ...snapshot.playbookResult.findings.map((f) => ({ finding: f, module: 'PLAYBOOK' as const })),
    ...snapshot.openRiskResult.findings.map((f) => ({ finding: f, module: 'LLM' as const })),
    ...(snapshot.visionResult?.findings ?? []).map((f) => ({
      finding: f,
      module: 'VISION' as const,
    })),
  ];

  for (const { finding, module } of allFindings) {
    const detail = finding.evaluationDetail as EvidenceDetail | undefined;
    const spans = extractTextSpans(finding);
    for (const span of spans) {
      evidence.push({
        evidence_id: `ev_${randomUUID()}`,
        source_module: module,
        source_ref_id: finding.refId,
        evidence_type: 'TEXT_SPAN',
        field: span.field,
        start: span.start,
        end: span.end,
        text: span.text,
        regulation_ref: detail?.citation
          ? `${detail.citation.lawName}${detail.citation.article ? ` ${detail.citation.article}` : ''}`
          : undefined,
      });
    }

    const citation = detail?.citation;
    if (citation && spans.length === 0) {
      evidence.push({
        evidence_id: `ev_${randomUUID()}`,
        source_module: module,
        source_ref_id: finding.refId,
        evidence_type: 'CITATION',
        regulation_ref: `${citation.lawName}${citation.article ? ` ${citation.article}` : ''}`,
      });
    }

    if (spans.length === 0 && !citation) {
      evidence.push({
        evidence_id: `ev_${randomUUID()}`,
        source_module: module,
        source_ref_id: finding.refId,
        evidence_type: 'SUMMARY',
        text: finding.summary,
      });
    }
  }

  return evidence;
}

function buildRegulations(snapshot: ReviewCaseSnapshot): CaseRegulationRef[] {
  const refs: CaseRegulationRef[] = [];
  const seen = new Set<string>();

  for (const finding of snapshot.ruleResult.findings) {
    const citation = finding.evaluationDetail?.citation;
    if (!citation) {
      continue;
    }
    const key = `${citation.lawName}|${citation.article ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    refs.push({
      law_name: citation.lawName,
      article: citation.article,
      jurisdiction: snapshot.context.dimensions.countryId,
      source_module: 'RULE',
      source_ref_id: finding.refId,
    });
  }

  return refs;
}

function buildRecommendation(
  decision: ReviewDecisionResult,
  snapshot: ReviewCaseSnapshot,
): CaseRecommendation {
  const actions: CaseRecommendation['actions'] = [];
  let priority = 1;

  for (const finding of snapshot.ruleResult.findings) {
    if (finding.severity === 'BLOCKER') {
      actions.push({
        priority: priority++,
        action: 'REMOVE_OR_REWORD',
        target: 'text',
        detail: finding.summary,
      });
    }
  }

  for (const finding of snapshot.playbookResult.findings) {
    actions.push({
      priority: priority++,
      action: 'REVIEW_PLAYBOOK',
      target: finding.refId,
      detail: finding.summary,
    });
  }

  for (const finding of snapshot.openRiskResult.findings) {
    const suggested = finding.evaluationDetail?.suggestedAction;
    actions.push({
      priority: priority++,
      action: suggested ?? 'MANUAL_REVIEW',
      target: finding.refId,
      detail: finding.summary,
    });
  }

  for (const finding of snapshot.visionResult?.findings ?? []) {
    const suggested = finding.evaluationDetail?.suggestedAction;
    actions.push({
      priority: priority++,
      action: suggested ?? 'MANUAL_REVIEW',
      target: finding.refId,
      detail: finding.summary,
    });
  }

  return {
    summary: decision.rationale,
    actions,
    derived_from: [
      'matched_rules',
      'matched_playbooks',
      'llm_analysis',
      'vision_analysis',
      'decision.rationale',
    ],
  };
}

export type CaseBuilderInput = ReviewHappyPathResult & {
  caseSnapshot: ReviewCaseSnapshot;
};

export class CaseBuilderService {
  constructor(private readonly config: CaseBuilderConfig = {}) {}

  build(input: CaseBuilderInput): CaseRecord {
    const now = (this.config.now ?? (() => new Date()))().toISOString();
    const caseId = `case_${(this.config.createCaseId ?? randomUUID)()}`;
    const { context, ruleResult, playbookResult, openRiskResult, visionResult } = input.caseSnapshot;
    const { decision, report } = input;
    const normalized = context.normalizedContent;

    const record: CaseRecord = {
      schema_version: CASE_SCHEMA_VERSION,
      case_version: 1,
      case_id: caseId,
      review_id: input.reviewId,
      advertisement_id: input.advertisementId,
      lifecycle_status: 'GENERATED',
      dimensions: {
        tenant_id: context.dimensions.tenantId,
        country_id: context.dimensions.countryId,
        platform_id: context.dimensions.platformId,
        category_id: context.dimensions.categoryId,
        legal_reviewed_market: isLegalReviewedMarket(context.dimensions.countryId),
      },
      advertisement: {
        advertisement_id: input.advertisementId,
        content_hash: context.contentHash,
        content_version: context.contentVersion,
        ad_type: resolveAdType(input.caseSnapshot),
        content: {
          text: normalized.text,
          ...(normalized.ocrText ? { ocr_text: normalized.ocrText } : {}),
          ...(normalized.language ? { language: normalized.language } : {}),
          image_urls: normalized.imageUrls,
          ...(normalized.landingUrl ? { landing_url: normalized.landingUrl } : {}),
        },
        tags: context.tags,
      },
      context_builder_output: {
        review_id: context.reviewId,
        content_hash: context.contentHash,
        content_version: context.contentVersion,
        normalized_content: normalized,
        resolved_knowledge_versions: context.resolvedKnowledgeVersions,
        advertisement_context: context.advertisementContext,
        tags: context.tags,
        built_at: context.builtAt,
      },
      matched_rules: ruleResult.findings.map(mapFinding),
      matched_playbooks: playbookResult.findings.map(mapFinding),
      llm_analysis: {
        prompt_pack_version: openRiskResult.promptPackVersion,
        ...(openRiskResult.model ? { llm_model: openRiskResult.model } : {}),
        skipped: openRiskResult.skipped,
        ...(openRiskResult.skipReason ? { skip_reason: openRiskResult.skipReason } : {}),
        findings: openRiskResult.findings.map(mapFinding),
        evaluated_at: openRiskResult.evaluatedAt,
      },
      ...(visionResult
        ? {
            vision_analysis: {
              prompt_pack_version: visionResult.promptPackVersion,
              ...(visionResult.model ? { llm_model: visionResult.model } : {}),
              skipped: visionResult.skipped,
              ...(visionResult.skipReason ? { skip_reason: visionResult.skipReason } : {}),
              findings: visionResult.findings.map(mapFinding),
              evaluated_at: visionResult.evaluatedAt,
            },
          }
        : {}),
      decision: {
        ai_decision: decision.finalDecision,
        confidence: decision.confidence,
        rationale: decision.rationale,
        finding_counts: decision.findingCounts,
        decided_at: decision.decidedAt,
        final_decision: decision.finalDecision,
      },
      evidence: buildEvidence(input.caseSnapshot),
      recommendation: buildRecommendation(decision, input.caseSnapshot),
      human_feedback: null,
      reference_regulations: buildRegulations(input.caseSnapshot),
      metadata: {
        source: 'demo/review',
        pipeline_version: this.config.pipelineVersion ?? '0.1.0-sprint1.5',
        open_risk_skipped: report.summary.openRiskSkipped,
        storage_phase: 'json',
        review_id: input.reviewId,
        embedding_id: null,
        similar_case_ids: [],
      },
      created_at: now,
      updated_at: now,
    };

    return record;
  }
}
