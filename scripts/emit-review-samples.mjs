/**
 * Emit API-shaped JSON for PASS / WARN / REJECT samples.
 * Usage: pnpm --filter @aairp/application build && node scripts/emit-review-samples.mjs
 */
import { AdvertisementUploadService } from '../packages/application/dist/advertisement/advertisement-upload.service.js';
import { ContextBuilderService } from '../packages/application/dist/review/context-builder.service.js';
import { ReviewHappyPathService } from '../packages/application/dist/review/review-happy-path.service.js';
import { ReviewPipelineService } from '../packages/application/dist/review/review-pipeline.service.js';
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { OpenRiskDiscoveryService } from '../packages/application/dist/review/open-risk-discovery.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';
import { ReviewReportService } from '../packages/application/dist/review/review-report.service.js';

const pipeline = new ReviewPipelineService({
  ruleEngineService: new RuleEngineService(),
  playbookEngineService: new PlaybookEngineService(),
  openRiskDiscoveryService: new OpenRiskDiscoveryService(),
  decisionEngineService: new DecisionEngineService(),
  reviewReportService: new ReviewReportService(),
});

const happyPath = new ReviewHappyPathService({
  advertisementUploadService: new AdvertisementUploadService(),
  contextBuilderService: new ContextBuilderService(),
  reviewPipelineService: pipeline,
});

const samples = [
  {
    label: 'PASS',
    body: {
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'sa.air_fryer',
      content: { text: 'Dual heat zones for even crisp results. Model KL600-V7. #ad' },
    },
  },
  {
    label: 'WARN',
    body: {
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'sa.rice_cooker',
      content: { text: '[Rice Cooker] Cooked slow. Eaten well' },
    },
  },
  {
    label: 'REJECT',
    body: {
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'sa.air_fryer',
      content: { text: '[Air Fryer] Your cardiologist would probably approve' },
    },
  },
];

function toApiShape(result) {
  const report = result.report;
  return {
    review_id: result.reviewId,
    advertisement_id: result.advertisementId,
    final_decision: result.decision.finalDecision,
    confidence: result.decision.confidence,
    rationale: result.decision.rationale,
    finding_counts: result.decision.findingCounts,
    summary: report.summary,
    generated_at: report.generatedAt,
    open_risk_skipped: report.summary.openRiskSkipped,
    open_risk_skip_reason: report.summary.openRiskSkipReason ?? null,
  };
}

for (const sample of samples) {
  const result = await happyPath.run(sample.body);
  console.log(
    JSON.stringify(
      {
        sample: sample.label,
        request: sample.body,
        response: toApiShape(result),
      },
      null,
      2,
    ),
  );
  console.log('---');
}
