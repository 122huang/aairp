import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '../persistence/clients.js';
import { PgCaseKosRepository } from './pg-case-kos.repository.js';
import { CASE_SCHEMA_VERSION, type CaseRecord } from '@aairp/shared-kernel';

function samplePayload(overrides: Partial<CaseRecord> = {}): CaseRecord {
  const now = '2026-07-18T12:00:00.000Z';
  return {
    schema_version: CASE_SCHEMA_VERSION,
    case_version: 1,
    case_id: 'case_pg_001',
    review_id: 'rev_pg_001',
    advertisement_id: 'ad_pg_001',
    thread_id: 'thread_pg_001',
    lifecycle_status: 'GENERATED',
    dimensions: {
      tenant_id: 'demo',
      country_id: 'MY',
      platform_id: 'META',
      category_id: 'sa.air_fryer',
      legal_reviewed_market: true,
    },
    advertisement: {
      advertisement_id: 'ad_pg_001',
      content_hash: 'hash_pg',
      content_version: 1,
      ad_type: 'INFLUENCER_UGC',
      content: {
        text: 'Crispy snacks for Malaysian families.',
        language: 'en',
        image_urls: [],
      },
      tags: [],
    },
    context_builder_output: {
      review_id: 'rev_pg_001',
      content_hash: 'hash_pg',
      content_version: 1,
      normalized_content: { text: 'Crispy snacks for Malaysian families.', imageUrls: [] },
      resolved_knowledge_versions: {
        rulePackVersion: 'demo-rule-1.8.8',
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
      ai_decision: 'INFO',
      confidence: 0.9,
      rationale: 'disclosure reminder',
      finding_counts: { rule: 1, playbook: 0, llm: 0 },
      decided_at: now,
      final_decision: 'PASS',
    },
    evidence: [],
    recommendation: { summary: 'ok', actions: [], derived_from: [] },
    human_feedback: null,
    reference_regulations: [],
    metadata: {
      source: 'demo/review',
      pipeline_version: 'test',
      open_risk_skipped: true,
      storage_phase: 'postgres',
      review_id: 'rev_pg_001',
      embedding_id: null,
      similar_case_ids: [],
    },
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function mockRow(record: CaseRecord) {
  return {
    case_id: record.case_id,
    case_version: record.case_version,
    review_id: record.review_id,
    lifecycle_status: record.lifecycle_status,
    payload_json: record,
    created_at: new Date(record.created_at),
    updated_at: new Date(record.updated_at),
  };
}

describe('PgCaseKosRepository.search history filters', () => {
  it('binds case_id, thread_id, created_from, and created_to into SQL params', async () => {
    const record = samplePayload();
    const captured: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      // Repository mutates the same params array between COUNT and SELECT.
      captured.push({ sql, params: [...params] });
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ count: '1' }] };
      }
      return { rows: [mockRow(record)] };
    });
    const db: DatabaseClient = { query };
    const repo = new PgCaseKosRepository(db);

    const result = await repo.search({
      case_id: 'case_pg_001',
      thread_id: 'thread_pg_001',
      created_from: '2026-07-01T00:00:00.000Z',
      created_to: '2026-07-31T23:59:59.999Z',
      limit: 20,
      offset: 5,
    });

    expect(captured).toHaveLength(2);
    const countCall = captured[0]!;
    const listCall = captured[1]!;

    expect(countCall.sql).toContain('cr.case_id = $1');
    expect(countCall.sql).toContain(
      "coalesce(nullif(cr.payload_json->>'thread_id', ''), cr.case_id) = $2",
    );
    expect(countCall.sql).toContain('cr.created_at >= $3::timestamptz');
    expect(countCall.sql).toContain('cr.created_at <= $4::timestamptz');
    expect(countCall.params).toEqual([
      'case_pg_001',
      'thread_pg_001',
      '2026-07-01T00:00:00.000Z',
      '2026-07-31T23:59:59.999Z',
    ]);

    expect(listCall.sql).toContain('LIMIT $5 OFFSET $6');
    expect(listCall.params).toEqual([
      'case_pg_001',
      'thread_pg_001',
      '2026-07-01T00:00:00.000Z',
      '2026-07-31T23:59:59.999Z',
      20,
      5,
    ]);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.case_id).toBe('case_pg_001');
    expect(result.items[0]?.thread_id).toBe('thread_pg_001');
    expect(result.items[0]?.text_preview).toContain('Crispy snacks');
  });

  it('falls back missing payload thread_id to case_id in WHERE clause', async () => {
    const captured: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      captured.push({ sql, params: [...params] });
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '0' }] };
      return { rows: [] };
    });
    const repo = new PgCaseKosRepository({ query });

    await repo.search({ thread_id: 'case_as_thread' });

    expect(captured[0]?.sql).toContain(
      "coalesce(nullif(cr.payload_json->>'thread_id', ''), cr.case_id)",
    );
    expect(captured[0]?.params).toEqual(['case_as_thread']);
  });
});
