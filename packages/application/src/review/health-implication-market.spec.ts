/**
 * Regression: CN/JP/KR have no Rule/Playbook health-implication layer.
 * Verifies that RECALL_ONLY_RISK_TYPES forcing upgrades health-implication WARN → REVIEW.
 * Test copy: "细腻破壁，帮助释放食材中的营养" (implied nutrient-retention, no disease claim).
 * See handover doc §11.3 for the approved fix decision.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';

const demoPromptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/open-risk.prompt.txt',
);

const AD_TEXT = '细腻破壁，帮助释放食材中的营养。';

const baseCtx: Omit<ReviewContext, 'dimensions'> = {
  reviewId: 'rev_health_mkt_test',
  advertisementId: 'ad_health_mkt_test',
  contentHash: 'hash_health_mkt',
  contentVersion: 1,
  normalizedContent: { text: AD_TEXT, imageUrls: [] },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-07-16T08:00:00.000Z',
};

describe('health-implication RECALL_ONLY forcing — CN / JP / KR markets', () => {
  it.each([
    { countryId: 'CN', categoryId: 'sa.blender_processor' },
    { countryId: 'JP', categoryId: 'sa.blender_processor' },
    { countryId: 'KR', categoryId: 'sa.blender_processor' },
  ])(
    '$countryId: LLM WARN → forced REVIEW when risk_type is health-implication',
    async ({ countryId, categoryId }) => {
      const context: ReviewContext = {
        ...baseCtx,
        dimensions: { tenantId: 'demo', countryId, platformId: 'META', categoryId },
      };

      const service = new OpenRiskDiscoveryService({
        promptPath: demoPromptPath,
        llmGateway: {
          complete: vi.fn().mockResolvedValue({
            content: JSON.stringify({
              findings: [
                {
                  risk_type: 'health-implication',
                  description:
                    '「帮助释放食材中的营养」暗示营养保留功效，存在证据边界——请确认内部是否有对应测试数据支撑。',
                  severity: 'MEDIUM',
                  suggested_action: 'WARN',
                  confidence: 0.72,
                  evidence_spans: [
                    { field: 'text', start: 0, end: AD_TEXT.length, text: AD_TEXT },
                  ],
                  related_modules_checked: [],
                },
              ],
            }),
          }),
        },
      });

      const result = await service.discover(context, {
        hasBlocker: false,
        ruleFindings: [],
        playbookFindings: [],
      });

      expect(result.findings).toHaveLength(1);
      const finding = result.findings[0]!;
      expect(finding.decision).toBe('REVIEW');
      expect(finding.evaluationDetail?.suggestedAction).toBe('MANUAL_REVIEW');
      expect(finding.evaluationDetail?.riskType).toBe('health-implication');
    },
  );
});
