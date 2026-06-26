import { describe, expect, it, vi } from 'vitest';
import type { CaseManifestEntry, ICaseStore, IKosSearchRepository } from '@aairp/shared-kernel';
import { KosSearchService } from './kos-search.service.js';

const manifestEntry: CaseManifestEntry = {
  case_id: 'case_example_sg_health_reject',
  case_version: 1,
  path: 'examples/sg-health-reject-cure.case.json',
  review_id: 'rev_example',
  country_id: 'SG',
  category_id: 'health.supplement',
  platform_id: 'META',
  ai_decision: 'REJECT',
  final_decision: 'REJECT',
  lifecycle_status: 'GENERATED',
  content_hash: 'sha256:example',
  created_at: '2026-06-26T10:00:00.000Z',
  updated_at: '2026-06-26T10:00:00.000Z',
};

function createRepositoryMock(): IKosSearchRepository {
  return {
    searchRules: vi.fn().mockResolvedValue({
      items: [
        {
          objectType: 'rule',
          objectId: 'rv-1',
          title: 'SG-HEALTH-CURE',
          snippet: 'Prohibits cure claims',
          meta: { rule_key: 'SG-HEALTH-CURE', source: 'postgres' },
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    }),
    searchCasesInDb: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    }),
    searchRegulations: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    }),
  };
}

function createCaseStoreMock(): ICaseStore {
  return {
    save: vi.fn(),
    findByCaseId: vi.fn().mockResolvedValue({
      case_id: manifestEntry.case_id,
      advertisement: {
        content: { text: 'Clinically proven to cure diabetes in 7 days.' },
      },
      decision: { rationale: 'Absolute cure claim' },
      matched_rules: [{ summary: 'cure claim detected' }],
    }),
    findByReviewId: vi.fn(),
    search: vi.fn(),
    listManifest: vi.fn().mockResolvedValue([manifestEntry]),
    exportAll: vi.fn(),
  } as unknown as ICaseStore;
}

describe('KosSearchService', () => {
  it('searches rules when type=rule', async () => {
    const repository = createRepositoryMock();
    const service = new KosSearchService(repository, createCaseStoreMock());

    const result = await service.search({
      type: 'rule',
      q: 'cure',
      countryId: 'SG',
      limit: 20,
      offset: 0,
    });

    expect(repository.searchRules).toHaveBeenCalledWith({
      q: 'cure',
      countryId: 'SG',
      limit: 20,
      offset: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.objectType).toBe('rule');
  });

  it('falls back to JSON cases when DB is empty', async () => {
    const repository = createRepositoryMock();
    const caseStore = createCaseStoreMock();
    const service = new KosSearchService(repository, caseStore);

    const result = await service.search({
      type: 'case',
      q: 'cure',
      countryId: 'SG',
      limit: 20,
      offset: 0,
    });

    expect(repository.searchCasesInDb).toHaveBeenCalled();
    expect(caseStore.listManifest).toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      objectType: 'case',
      objectId: manifestEntry.case_id,
      meta: { source: 'json', country_id: 'SG' },
    });
  });

  it('merges rule and case results when type=all', async () => {
    const repository = createRepositoryMock();
    const caseStore = createCaseStoreMock();
    const service = new KosSearchService(repository, caseStore);

    const result = await service.search({
      q: 'cure',
      limit: 20,
      offset: 0,
    });

    expect(result.items.some((item) => item.objectType === 'rule')).toBe(true);
    expect(result.items.some((item) => item.objectType === 'case')).toBe(true);
    expect(result.total).toBe(2);
  });
});
