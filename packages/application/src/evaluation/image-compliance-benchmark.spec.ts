import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { VisionComplianceService } from '../review/vision-compliance.service.js';

type ImageComplianceCase = {
  case_id: string;
  scenario_id: string;
  polarity: 'positive' | 'negative';
  expected_decision: 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';
  expected_risk_types: string[];
  fixture: {
    country_id: string;
    platform_id: string;
    category_id: string;
    text: string;
    image_urls: string[];
    image_dimensions?: Array<{ width: number; height: number }>;
    ai_rendered_image?: boolean;
  };
};

type ImageComplianceManifest = {
  manifest_version: string;
  pack_version: string;
  scenarios: ImageComplianceCase[];
};

const manifestPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../benchmark/image-compliance-v1.json',
);

function loadManifest(): ImageComplianceManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ImageComplianceManifest;
}

function toReviewContext(testCase: ImageComplianceCase): ReviewContext {
  return {
    reviewId: `rev_${testCase.case_id}`,
    advertisementId: `ad_${testCase.case_id}`,
    contentHash: `hash_${testCase.case_id}`,
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: testCase.fixture.country_id,
      platformId: testCase.fixture.platform_id,
      categoryId: testCase.fixture.category_id,
    },
    normalizedContent: {
      text: testCase.fixture.text,
      imageUrls: testCase.fixture.image_urls,
      ...(testCase.fixture.image_dimensions
        ? { imageDimensions: testCase.fixture.image_dimensions }
        : {}),
    },
    resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
    advertisementContext: {
      ...(testCase.fixture.ai_rendered_image
        ? { aiRenderedImage: testCase.fixture.ai_rendered_image }
        : {}),
    },
    tags: ['image-compliance-benchmark'],
    builtAt: '2026-06-29T00:00:00.000Z',
  };
}

describe('image-compliance-v1 benchmark (stub fixtures)', () => {
  const manifest = loadManifest();

  it('loads eight cases across four scenario families', () => {
    expect(manifest.scenarios).toHaveLength(8);
    expect(new Set(manifest.scenarios.map((item) => item.scenario_id)).size).toBe(4);
    for (const scenarioId of [
      'cn-panel-unreplaced',
      'competitor-logo',
      'ai-image-no-disclaimer',
      'food-safety-raw-meat',
    ]) {
      const cases = manifest.scenarios.filter((item) => item.scenario_id === scenarioId);
      expect(cases.map((item) => item.polarity).sort()).toEqual(['negative', 'positive']);
    }
  });

  it('returns scenario-specific risk types for positive cases and empty findings for negative cases', async () => {
    const previous = process.env.AAIRP_VISION_MODE;
    process.env.AAIRP_VISION_MODE = 'stub';

    try {
      const service = new VisionComplianceService();

      for (const testCase of manifest.scenarios) {
        const result = await service.discover(toReviewContext(testCase));
        const riskTypes = result.findings.map((finding) => finding.refId).sort();

        expect(result.skipped, testCase.case_id).toBe(false);
        expect(result.promptPackVersion, testCase.case_id).toBe('demo-vision-1.0.0');

        // Tall fixtures may yield the same risk_type across multiple slices;
        // benchmark expectations are about which risk types appear, not multiplicity.
        const uniqueRiskTypes = [...new Set(riskTypes)].sort();

        if (testCase.polarity === 'positive') {
          expect(uniqueRiskTypes, testCase.case_id).toEqual(
            [...testCase.expected_risk_types].sort(),
          );
          if (testCase.expected_decision === 'REJECT') {
            expect(result.hasBlocker, testCase.case_id).toBe(true);
          } else {
            expect(result.hasBlocker, testCase.case_id).toBe(false);
          }
        } else {
          expect(uniqueRiskTypes, testCase.case_id).toEqual([]);
          expect(result.hasBlocker, testCase.case_id).toBe(false);
        }
      }
    } finally {
      if (previous === undefined) {
        delete process.env.AAIRP_VISION_MODE;
      } else {
        process.env.AAIRP_VISION_MODE = previous;
      }
    }
  });
});
