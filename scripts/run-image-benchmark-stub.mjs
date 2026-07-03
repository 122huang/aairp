#!/usr/bin/env node
/**
 * Sprint 6A — offline CI runner for image-compliance-v1 benchmark (stub mode).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VisionComplianceService } from '../packages/application/dist/review/vision-compliance.service.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(rootDir, 'benchmark/image-compliance-v1.json');

process.env.AAIRP_VISION_MODE = process.env.AAIRP_VISION_MODE ?? 'stub';

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const service = new VisionComplianceService();

let passed = 0;
let failed = 0;

for (const testCase of manifest.scenarios) {
  const context = {
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
    resolvedKnowledgeVersions: {
      rulePackVersion: 'demo-rule-1.6.12',
      policyPackVersion: 'demo-policy-1.0.0',
      playbookPackVersion: 'demo-playbook-1.5.7',
    },
    advertisementContext: {
      ...(testCase.fixture.ai_rendered_image
        ? { aiRenderedImage: testCase.fixture.ai_rendered_image }
        : {}),
    },
    tags: ['image-compliance-benchmark'],
    builtAt: new Date().toISOString(),
  };

  try {
    const result = await service.discover(context);
    const riskTypes = result.findings.map((finding) => finding.refId).sort();
    const expected = [...testCase.expected_risk_types].sort();
    const ok =
      !result.skipped &&
      result.promptPackVersion === 'demo-vision-1.0.0' &&
      JSON.stringify(riskTypes) === JSON.stringify(expected);

    if (ok) {
      passed += 1;
      console.log(
        `PASS ${testCase.case_id} (${testCase.scenario_id}/${testCase.polarity}) risks=${riskTypes.join(',') || 'none'}`,
      );
    } else {
      failed += 1;
      console.error(
        `FAIL ${testCase.case_id} — expected risks ${expected.join(',') || 'none'} got ${riskTypes.join(',') || 'none'}`,
        result,
      );
    }
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${testCase.case_id} —`, error);
  }
}

console.log(`\nimage-compliance-v1 stub summary: ${passed}/${manifest.scenarios.length} passed`);

if (failed > 0) {
  process.exitCode = 1;
}
