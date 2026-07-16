import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CaseImportService } from './case-import.service.js';
import { CASE_SCHEMA_VERSION } from '@aairp/shared-kernel';

function minimalCase(caseId: string, reviewId: string) {
  const now = '2026-06-26T10:10:00.000Z';
  return {
    schema_version: CASE_SCHEMA_VERSION,
    case_version: 1,
    case_id: caseId,
    review_id: reviewId,
    advertisement_id: 'ad_test',
    lifecycle_status: 'GENERATED',
    dimensions: {
      tenant_id: 'demo',
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      legal_reviewed_market: true,
    },
    advertisement: {
      advertisement_id: 'ad_test',
      content_hash: 'hash_test',
      content_version: 1,
      ad_type: 'SOCIAL_POST',
      content: { text: 'Buy now', language: 'en', image_urls: [] },
      tags: [],
    },
    context_builder_output: {
      review_id: reviewId,
      content_hash: 'hash_test',
      content_version: 1,
      normalized_content: { text: 'Buy now', imageUrls: [] },
      resolved_knowledge_versions: {
        rulePackVersion: 'demo-rule-1.0.0',
        policyPackVersion: 'demo-policy-1.0.0',
        playbookPackVersion: 'demo-playbook-1.0.0',
      },
      advertisement_context: {},
      tags: [],
      built_at: now,
    },
    matched_rules: [],
    matched_playbooks: [],
    llm_analysis: {
      prompt_pack_version: 'demo-open-risk-1.1.0',
      skipped: true,
      findings: [],
      evaluated_at: now,
    },
    decision: {
      ai_decision: 'FAIL',
      confidence: 0.9,
      rationale: 'test',
      finding_counts: { rule: 0, playbook: 0, llm: 0 },
      decided_at: now,
      final_decision: 'FAIL',
    },
    evidence: [],
    recommendation: { summary: 'test', actions: [], derived_from: [] },
    human_feedback: null,
    reference_regulations: [],
    metadata: {
      source: 'test',
      pipeline_version: 'test',
      open_risk_skipped: true,
      storage_phase: 'json',
      review_id: reviewId,
      embedding_id: null,
      similar_case_ids: [],
    },
    created_at: now,
    updated_at: now,
  };
}

describe('CaseImportService', () => {
  it('imports .case.json files from a directory tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'case-import-'));
    const examplesDir = join(root, 'examples');
    await mkdir(examplesDir, { recursive: true });
    await writeFile(
      join(examplesDir, 'one.case.json'),
      `${JSON.stringify(minimalCase('case_one', 'rev_one'), null, 2)}\n`,
      'utf8',
    );

    const repository = {
      save: vi.fn().mockResolvedValue({ case_id: 'case_one', path: 'kos://case_one/v1', created: true }),
    };
    const service = new CaseImportService({ caseKosRepository: repository as never });

    const result = await service.importFromDirectory(root);

    expect(result.imported).toBe(1);
    expect(result.items[0]?.case_id).toBe('case_one');
    await rm(root, { recursive: true, force: true });
  });
});
