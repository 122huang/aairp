import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  AdvertisementUploadService,
  ReviewHappyPathService,
  EvidenceService,
  EvidenceJudgmentService,
  bootstrapReviewRuntime,
} from '@aairp/application';
import type { ReviewReportFindingSummary } from '@aairp/shared-kernel';
import { supportsEvidenceAttachment } from '@aairp/shared-kernel';
import type { ILlmGateway } from '../review/stub-llm.gateway.types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const infraDist = join(repoRoot, 'packages/infrastructure/dist');
const { InMemoryAdvertisementRepository, JsonEvidenceStore } = await import(
  pathToFileURL(join(infraDist, 'index.js')).href
);

const reportPath = join(repoRoot, 'reports', 'evidence-e2e-run.json');
const evidenceDir = join(repoRoot, 'data', 'finding-evidence-e2e');

const AD_TEXT =
  'PC201/PC200 - Cook for up to 8-10 people. 6.5 qt nonstick cooking pot fits up to a 4lb. chicken or a 5lb. roast for creating meals for large groups.';

const CLM_EVIDENCE_TEXT = `CLM-012884 — Internal Capacity Test Memo (PC201/PC200)
Product models: PC201 / PC200 combination multi-cooker
Test method: Standard full-pot stew fill test. Total cooked food weight measured after draining on calibrated scale.
Measured total weight range: 1.96 kg – 2.45 kg (1960g – 2450g)
Reference standard: FDA single-serving reference weight 245g per person (conservative)
Calculation: 2450g ÷ 245g/person = 10 servings; conservative lower bound 8 servings at 1960g ÷ 245g = 8
Conclusion: Claim "Cook for up to 8-10 people" is supported by measured yield and documented methodology.
Raw data: Sample A 1960g, Sample B 2210g, Sample C 2450g — all divided by 245g reference.`;

const SGS_EVIDENCE_TEXT = `SGS Test Report No. SHES240100023371
Product under test: Rice Cooker Model 40N1S
Test subject: Non-stick coating adhesion performance
Test protocol: Internal SGS non-stick adhesion protocol
Result: Pass
Note: This report covers 40N1S rice cooker non-stick performance only — not PC201/PC200 capacity or serving-size claims.`;

function toBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

function resolveFindingRiskType(finding: ReviewReportFindingSummary): string {
  if (finding.rewriteSuggestions?.[0]?.riskType) return finding.rewriteSuggestions[0].riskType;
  if (finding.refId === 'demo-apac-sa-capacity-claim') return 'capacity-claim';
  return finding.refId;
}

function createTrackingGateway(): { gateway: ILlmGateway; getCalls: () => number; reset: () => void } {
  let calls = 0;
  const stubPath = join(repoRoot, 'demo/evidence-judgment.stub.json');
  return {
    gateway: {
      complete: async () => {
        calls += 1;
        return { content: readFileSync(stubPath, 'utf8') };
      },
    },
    getCalls: () => calls,
    reset: () => {
      calls = 0;
    },
  };
}

async function main() {
  process.env.AAIRP_OPEN_RISK_MODE = 'stub';
  process.env.AAIRP_EVIDENCE_JUDGMENT_MODE = 'stub';
  process.env.AAIRP_REWRITE_MODE = 'off';

  mkdirSync(evidenceDir, { recursive: true });
  mkdirSync(join(repoRoot, 'reports'), { recursive: true });

  const tracker = createTrackingGateway();
  const adRepo = new InMemoryAdvertisementRepository();
  const uploadService = new AdvertisementUploadService(adRepo, { defaultTenantId: 'demo' });
  const runtime = await bootstrapReviewRuntime(adRepo);

  const happyPath = new ReviewHappyPathService({
    advertisementUploadService: uploadService,
    contextBuilderService: runtime.contextBuilderService,
    reviewPipelineService: runtime.reviewPipelineService,
  });

  const evidenceStore = new JsonEvidenceStore({ rootPath: evidenceDir });
  const judgmentService = new EvidenceJudgmentService({
    evidenceStore,
    llmGateway: tracker.gateway,
  });
  const evidenceService = new EvidenceService(evidenceStore, judgmentService);

  const reviewResult = await happyPath.run({
    country_id: 'SG',
    platform_id: 'demo-review',
    category_id: 'sa.rice_cooker',
    content: { text: AD_TEXT },
    context: { product_sku: 'PC201' },
    tags: ['e2e:evidence-phase2'],
  });

  const allFindings = reviewResult.report.summary.findings;
  const evidenceEligible = allFindings.filter((f) =>
    supportsEvidenceAttachment(f.remediationType, f.decision),
  );

  const ruleEval = await runtime.ruleEngineService.evaluate(
    runtime.contextBuilderService.buildFromAdvertisement(
      await uploadService.upload({
        country_id: 'SG',
        platform_id: 'demo-review',
        category_id: 'sa.rice_cooker',
        content: { text: AD_TEXT },
        context: { product_sku: 'PC201' },
      }),
    ),
  );
  const ruleCapacityHit = ruleEval.findings.find((f) => f.refId === 'demo-apac-sa-capacity-claim');

  let capacityFinding: ReviewReportFindingSummary | undefined = allFindings.find(
    (f) => f.refId === 'demo-apac-sa-capacity-claim' || resolveFindingRiskType(f) === 'capacity-claim',
  );

  if (!capacityFinding && ruleCapacityHit) {
    capacityFinding = {
      findingId: ruleCapacityHit.findingId,
      module: 'RULE',
      refId: ruleCapacityHit.refId,
      severity: ruleCapacityHit.severity,
      decision: ruleCapacityHit.decision,
      summary: ruleCapacityHit.summary,
      remediationType: ruleCapacityHit.remediationType,
      evidenceSpans: ruleCapacityHit.evaluationDetail?.matchedSpans,
    };
  }

  if (!capacityFinding || !ruleCapacityHit) {
    throw new Error(
      'Step 1 failed: demo-apac-sa-capacity-claim did not match real ad copy — no capacity finding for evidence flow.',
    );
  }

  const claimAnchor = capacityFinding.evidenceSpans?.[0]?.text ?? 'Cook for up to 8-10 people';
  const riskType = resolveFindingRiskType(capacityFinding);

  const judgmentContextBase = {
    country_id: 'SG',
    category_id: 'sa.rice_cooker',
    product_sku: 'PC201',
    ad_text: AD_TEXT,
    finding_summary: capacityFinding.summary,
    remediation_type: capacityFinding.remediationType ?? 'EVIDENCE_SUPPLEMENT',
    risk_type: riskType,
    claim_anchor_text: claimAnchor,
    matched_spans: capacityFinding.evidenceSpans,
  };

  tracker.reset();
  const clmLink = await evidenceService.createAndAttach(
    reviewResult.reviewId,
    capacityFinding.findingId,
    {
      title: 'CLM-012884 Internal capacity test memo (PC201/PC200)',
      evidence_source_type: 'INTERNAL_TEST',
      scope: { countries: ['SG'], categories: ['sa.rice_cooker'], skus: ['PC201', 'PC200'] },
      claim_risk_types: [riskType],
      file: {
        filename: 'CLM-012884-capacity-memo.txt',
        mime_type: 'text/plain',
        content_base64: toBase64(CLM_EVIDENCE_TEXT),
      },
    },
    {
      judgmentContext: {
        review_id: reviewResult.reviewId,
        finding_id: capacityFinding.findingId,
        ...judgmentContextBase,
      },
    },
  );
  const clmLlmCalls = tracker.getCalls();

  tracker.reset();
  const sgsLink = await evidenceService.createAndAttach(
    reviewResult.reviewId,
    capacityFinding.findingId,
    {
      title: 'SGS SHES240100023371 Non-stick performance test (40N1S)',
      evidence_source_type: 'THIRD_PARTY_LAB',
      scope: { skus: ['40N1S'] },
      claim_risk_types: [riskType],
      file: {
        filename: 'SHES240100023371.txt',
        mime_type: 'text/plain',
        content_base64: toBase64(SGS_EVIDENCE_TEXT),
      },
    },
    {
      judgmentContext: {
        review_id: reviewResult.reviewId,
        finding_id: capacityFinding.findingId,
        ...judgmentContextBase,
      },
    },
  );
  const sgsLlmCalls = tracker.getCalls();

  const report = {
    run_at: new Date().toISOString(),
    mode: 'application-layer-e2e (postgres/redis unavailable — API server not started)',
    ad_text: AD_TEXT,
    product_sku: 'PC201',
    review: {
      review_id: reviewResult.reviewId,
      final_decision: reviewResult.decision.finalDecision,
      finding_count: allFindings.length,
      all_findings: allFindings.map((f) => ({
        finding_id: f.findingId,
        module: f.module,
        ref_id: f.refId,
        decision: f.decision,
        remediation_type: f.remediationType,
        summary: f.summary,
        evidence_span: f.evidenceSpans?.[0]?.text,
      })),
      evidence_eligible_findings: evidenceEligible.map((f) => ({
        finding_id: f.findingId,
        ref_id: f.refId,
        remediation_type: f.remediationType,
      })),
      rule_engine_capacity_hit: Boolean(ruleCapacityHit),
      rule_engine_capacity_finding_id: ruleCapacityHit?.findingId ?? null,
    },
    capacity_finding_used: {
      finding_id: capacityFinding.findingId,
      ref_id: capacityFinding.refId,
      remediation_type: capacityFinding.remediationType,
      claim_anchor: claimAnchor,
    },
    clm_evidence: {
      link_id: clmLink.link_id,
      status: clmLink.status,
      llm_calls_during_judgment: clmLlmCalls,
      prescreen_excluded: clmLink.ai_judgment?.prescreen_excluded ?? false,
      ai_judgment: clmLink.ai_judgment,
      pass:
        clmLink.ai_judgment?.relevance === 'strong' &&
        clmLink.ai_judgment?.sufficiency === 'sufficient' &&
        !clmLink.ai_judgment?.prescreen_excluded,
    },
    sgs_misattach: {
      link_id: sgsLink.link_id,
      status: sgsLink.status,
      llm_calls_during_judgment: sgsLlmCalls,
      prescreen_excluded: sgsLink.ai_judgment?.prescreen_excluded ?? false,
      ai_judgment: sgsLink.ai_judgment,
      pass:
        sgsLink.ai_judgment?.relevance === 'none' &&
        sgsLink.ai_judgment?.prescreen_excluded === true &&
        sgsLlmCalls === 0,
    },
    checks: {
      step1_capacity_evidence_supplement: false as boolean,
      step2_clm_strong_sufficient: false as boolean,
      step3_prescreen_pc201_pc200_not_blocked: false as boolean,
      step4_sgs_prescreen_no_llm: false as boolean,
    },
  };

  report.checks.step1_capacity_evidence_supplement =
    Boolean(ruleCapacityHit) &&
    capacityFinding.refId === 'demo-apac-sa-capacity-claim' &&
    capacityFinding.remediationType === 'EVIDENCE_SUPPLEMENT';
  report.checks.step2_clm_strong_sufficient = report.clm_evidence.pass;
  report.checks.step3_prescreen_pc201_pc200_not_blocked = !report.clm_evidence.prescreen_excluded;
  report.checks.step4_sgs_prescreen_no_llm = report.sgs_misattach.pass;

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('=== Evidence E2E Run ===');
  console.log(`Report: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));

  const allPass =
    report.checks.step1_capacity_evidence_supplement &&
    report.checks.step2_clm_strong_sufficient &&
    report.checks.step3_prescreen_pc201_pc200_not_blocked &&
    report.checks.step4_sgs_prescreen_no_llm;

  process.exit(allPass ? 0 : 1);
}

void main();
