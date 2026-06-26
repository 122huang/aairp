import { describe, expect, it } from 'vitest';
import type { CaseManifestEntry, ICaseStore, ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { CaseRetrievalService } from './case-retrieval.service.js';

const baseContext: ReviewContext = {
  reviewId: 'rev_new',
  advertisementId: 'ad_new',
  contentHash: 'hash_exact',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'META',
    categoryId: 'health.supplement',
  },
  normalizedContent: { text: 'Sample ad', imageUrls: [] },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-06-26T10:00:00.000Z',
};

function createStore(entries: CaseManifestEntry[]): ICaseStore {
  return {
    save: async () => ({ case_id: 'case_x', path: 'x', created: true }),
    findByCaseId: async () => null,
    findByReviewId: async () => null,
    search: async (filters) =>
      entries.filter((entry) => {
        if (filters.content_hash && entry.content_hash !== filters.content_hash) {
          return false;
        }
        if (filters.country_id && entry.country_id !== filters.country_id) {
          return false;
        }
        if (filters.category_id && entry.category_id !== filters.category_id) {
          return false;
        }
        if (filters.platform_id && entry.platform_id !== filters.platform_id) {
          return false;
        }
        return true;
      }),
    listManifest: async () => entries,
    exportAll: async () => [],
  };
}

describe('CaseRetrievalService', () => {
  const manifestEntry: CaseManifestEntry = {
    case_id: 'case_001',
    case_version: 1,
    path: 'cases/case_001.json',
    review_id: 'rev_old',
    country_id: 'SG',
    category_id: 'health.supplement',
    platform_id: 'META',
    ai_decision: 'WARN',
    final_decision: 'WARN',
    lifecycle_status: 'CONFIRMED',
    content_hash: 'hash_exact',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  };

  it('returns exact hash match with score 1.0', async () => {
    const service = new CaseRetrievalService(createStore([manifestEntry]), {
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });

    const result = await service.retrieve(baseContext);

    expect(result.precedents).toHaveLength(1);
    expect(result.precedents[0]).toMatchObject({
      case_id: 'case_001',
      similarity_score: 1,
      match_reason: 'exact content hash match',
    });
  });

  it('excludes the current review id from precedents', async () => {
    const service = new CaseRetrievalService(
      createStore([{ ...manifestEntry, review_id: 'rev_new' }]),
    );

    const result = await service.retrieve(baseContext);
    expect(result.precedents).toHaveLength(0);
  });

  it('uses hybrid vector strategy when embeddings are available', async () => {
    const previous = process.env.AAIRP_CASE_VECTOR_RETRIEVAL;
    const previousCaseFirst = process.env.AAIRP_CASE_FIRST_ENABLED;
    process.env.AAIRP_CASE_FIRST_ENABLED = 'true';
    process.env.AAIRP_CASE_VECTOR_RETRIEVAL = 'true';

    try {
      const { DeterministicHashEmbeddingProvider } = await import(
        './deterministic-hash-embedding.provider.js'
      );
      const provider = new DeterministicHashEmbeddingProvider();
      const embedText =
        'country=SG category=health.supplement platform=META content=cure diabetes clinically proven';
      const embeddingRepository = {
        upsert: async () => {},
        findByCaseId: async () => null,
        findByCaseIds: async () => [
          {
            case_id: 'case_001',
            case_version: 1,
            embedding_model: provider.modelId,
            embedding: provider.embed(embedText),
            embed_text: embedText,
            dimensions: provider.dimensions,
            created_at: '2026-06-26T10:00:00.000Z',
          },
        ],
      };

      const service = new CaseRetrievalService(
        {
          ...createStore([
            {
              ...manifestEntry,
              content_hash: 'hash_other',
              review_id: 'rev_old',
            },
          ]),
          findByCaseId: async () => ({
            schema_version: '1.0.0',
            case_version: 1,
            case_id: 'case_001',
            review_id: 'rev_old',
            advertisement_id: 'ad_old',
            lifecycle_status: 'CONFIRMED',
            dimensions: {
              tenant_id: 'demo',
              country_id: 'SG',
              platform_id: 'META',
              category_id: 'health.supplement',
            },
            advertisement: {
              advertisement_id: 'ad_old',
              content_hash: 'hash_other',
              content_version: 1,
              ad_type: 'SOCIAL_POST',
              content: {
                text: 'Clinically proven to cure diabetes fast',
                image_urls: [],
              },
              tags: [],
            },
            context_builder_output: {
              review_id: 'rev_old',
              content_hash: 'hash_other',
              content_version: 1,
              normalized_content: { text: 'Clinically proven to cure diabetes fast', imageUrls: [] },
              resolved_knowledge_versions: DEMO_KNOWLEDGE_VERSIONS,
              advertisement_context: {},
              tags: [],
              built_at: '2026-06-26T10:00:00.000Z',
            },
            matched_rules: [
              {
                finding_id: 'rf_old',
                ref_id: 'demo-sg-health-forbidden-claim',
                ref_version_id: 'v1',
                severity: 'BLOCKER',
                decision: 'FAIL',
                summary: 'Forbidden claim',
                confidence: 1,
              },
            ],
            matched_playbooks: [],
            llm_analysis: {
              prompt_pack_version: 'demo-open-risk-1.1.0',
              skipped: true,
              findings: [],
              evaluated_at: '2026-06-26T10:08:00.000Z',
            },
            decision: {
              ai_decision: 'REJECT',
              confidence: 0.95,
              rationale: 'Rule BLOCKER',
              finding_counts: { rule: 1, playbook: 0, llm: 0 },
              decided_at: '2026-06-26T10:09:00.000Z',
              final_decision: 'REJECT',
            },
            evidence: [],
            recommendation: { summary: 'Remove cure claim', actions: [], derived_from: [] },
            human_feedback: null,
            reference_regulations: [],
            metadata: {
              source: 'test',
              pipeline_version: 'test',
              open_risk_skipped: true,
              storage_phase: 'json',
              review_id: 'rev_old',
              embedding_id: null,
              similar_case_ids: [],
            },
            created_at: '2026-06-26T10:11:00.000Z',
            updated_at: '2026-06-26T10:11:00.000Z',
          }),
        },
        {},
        { embeddingRepository, embeddingProvider },
      );

      const result = await service.retrieve(
        {
          ...baseContext,
          contentHash: 'hash_new',
          normalizedContent: {
            text: 'Clinically proven to cure diabetes in 7 days',
            imageUrls: [],
          },
        },
        { ruleRefIds: ['demo-sg-health-forbidden-claim'] },
      );

      expect(result.retrieval_strategy).toBe('filter+vector+hybrid_v1');
      expect(result.precedents[0]?.match_reason).toContain('hybrid vector+facet');
      expect(result.precedents[0]?.similarity_score).toBeGreaterThan(0.5);
    } finally {
      if (previous === undefined) {
        delete process.env.AAIRP_CASE_VECTOR_RETRIEVAL;
      } else {
        process.env.AAIRP_CASE_VECTOR_RETRIEVAL = previous;
      }
      if (previousCaseFirst === undefined) {
        delete process.env.AAIRP_CASE_FIRST_ENABLED;
      } else {
        process.env.AAIRP_CASE_FIRST_ENABLED = previousCaseFirst;
      }
    }
  });
});
