import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCaseStore } from './json-case-store.js';
import type { CaseRecord } from '@aairp/shared-kernel';
import { CASE_SCHEMA_VERSION } from '@aairp/shared-kernel';

function sampleCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  const now = '2026-06-26T10:10:00.000Z';
  return {
    schema_version: CASE_SCHEMA_VERSION,
    case_version: 1,
    case_id: 'case_test_001',
    review_id: 'rev_test_001',
    advertisement_id: 'ad_test_001',
    lifecycle_status: 'GENERATED',
    dimensions: {
      tenant_id: 'demo',
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      legal_reviewed_market: true,
    },
    advertisement: {
      advertisement_id: 'ad_test_001',
      content_hash: 'hash_test',
      content_version: 1,
      ad_type: 'SOCIAL_POST',
      content: {
        text: 'Clinically proven to cure diabetes in 7 days. Buy now!',
        language: 'en',
        image_urls: [],
      },
      tags: [],
    },
    context_builder_output: {
      review_id: 'rev_test_001',
      content_hash: 'hash_test',
      content_version: 1,
      normalized_content: { text: 'Clinically proven to cure diabetes in 7 days. Buy now!', imageUrls: [] },
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
      skip_reason: 'HAS_BLOCKER',
      findings: [],
      evaluated_at: now,
    },
    decision: {
      ai_decision: 'REJECT',
      confidence: 0.95,
      rationale: 'Rule BLOCKER',
      finding_counts: { rule: 1, playbook: 0, llm: 0 },
      decided_at: now,
      final_decision: 'REJECT',
    },
    evidence: [],
    recommendation: {
      summary: 'Rule BLOCKER',
      actions: [],
      derived_from: ['decision.rationale'],
    },
    human_feedback: null,
    reference_regulations: [],
    metadata: {
      source: 'demo/review',
      pipeline_version: 'test',
      open_risk_skipped: true,
      storage_phase: 'json',
      review_id: 'rev_test_001',
      embedding_id: null,
      similar_case_ids: [],
    },
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('JsonCaseStore', () => {
  it('saves case json, manifest, and dimension index', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aairp-cases-'));
    try {
      const store = new JsonCaseStore({ rootPath: root });
      const record = sampleCase();

      const saved = await store.save(record);
      expect(saved.created).toBe(true);

      const fileRaw = await readFile(join(root, saved.path), 'utf8');
      const parsed = JSON.parse(fileRaw) as CaseRecord;
      expect(parsed.case_id).toBe('case_test_001');
      expect(parsed.schema_version).toBe(CASE_SCHEMA_VERSION);

      const manifestRaw = await readFile(join(root, 'index/manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestRaw) as { entries: Array<{ case_id: string }> };
      expect(manifest.entries).toHaveLength(1);

      const dimRaw = await readFile(
        join(root, 'index/by-dimension/SG/health.supplement/META/index.json'),
        'utf8',
      );
      const dimIndex = JSON.parse(dimRaw) as { case_ids: string[] };
      expect(dimIndex.case_ids).toContain('case_test_001');

      const byReview = await store.findByReviewId('rev_test_001');
      expect(byReview?.case_id).toBe('case_test_001');

      const search = await store.search({
        country_id: 'SG',
        category_id: 'health.supplement',
        platform_id: 'META',
      });
      expect(search).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('is idempotent on duplicate review_id', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aairp-cases-'));
    try {
      const store = new JsonCaseStore({ rootPath: root });
      const record = sampleCase();

      await store.save(record);
      const second = await store.save({ ...record, case_id: 'case_other' });
      expect(second.created).toBe(false);
      expect((await store.listManifest()).length).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('filters by case_id, thread_id, and created_from for history search', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aairp-cases-'));
    try {
      const store = new JsonCaseStore({ rootPath: root });
      await store.save(
        sampleCase({
          case_id: 'case_root',
          review_id: 'rev_root',
          thread_id: 'case_root',
          created_at: '2026-07-10T00:00:00.000Z',
          updated_at: '2026-07-10T00:00:00.000Z',
        }),
      );
      await store.save(
        sampleCase({
          case_id: 'case_child',
          review_id: 'rev_child',
          thread_id: 'case_root',
          parent_case_id: 'case_root',
          created_at: '2026-07-18T00:00:00.000Z',
          updated_at: '2026-07-18T00:00:00.000Z',
          decision: {
            ai_decision: 'WARN',
            confidence: 0.7,
            rationale: 'warn',
            finding_counts: { rule: 0, playbook: 0, llm: 1 },
            decided_at: '2026-07-18T00:00:00.000Z',
            final_decision: 'WARN',
          },
        }),
      );

      const byCase = await store.search({ case_id: 'case_child' });
      expect(byCase).toHaveLength(1);
      expect(byCase[0]?.thread_id).toBe('case_root');
      expect(byCase[0]?.text_preview).toContain('Clinically proven');

      const byThread = await store.search({ thread_id: 'case_root' });
      expect(byThread.map((e) => e.case_id).sort()).toEqual(['case_child', 'case_root']);

      const byDate = await store.search({ created_from: '2026-07-15T00:00:00.000Z' });
      expect(byDate).toHaveLength(1);
      expect(byDate[0]?.case_id).toBe('case_child');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
