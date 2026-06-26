import type {
  CaseManifestEntry,
  ICaseStore,
  IKosSearchRepository,
  KosSearchFilters,
  KosSearchHit,
  KosSearchResult,
} from '@aairp/shared-kernel';

export class KosSearchService {
  constructor(
    private readonly searchRepository: IKosSearchRepository,
    private readonly caseStore: ICaseStore,
  ) {}

  search(filters: KosSearchFilters): Promise<KosSearchResult> {
    const type = filters.type ?? 'all';
    const query = this.withoutType(filters);

    if (type === 'rule') {
      return this.searchRepository.searchRules(query);
    }
    if (type === 'case') {
      return this.searchCases(filters);
    }
    if (type === 'regulation') {
      return this.searchRepository.searchRegulations({
        ...query,
        jurisdiction: filters.jurisdiction ?? filters.countryId,
      });
    }

    return this.searchAll(filters);
  }

  private withoutType(
    filters: KosSearchFilters,
  ): Omit<KosSearchFilters, 'type'> {
    return {
      q: filters.q,
      countryId: filters.countryId,
      categoryId: filters.categoryId,
      jurisdiction: filters.jurisdiction,
      status: filters.status,
      severity: filters.severity,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  private async searchAll(filters: KosSearchFilters): Promise<KosSearchResult> {
    const query = this.withoutType(filters);
    const perTypeLimit = Math.max(Math.ceil(filters.limit / 3), 1);
    const [rules, cases, regulations] = await Promise.all([
      this.searchRepository.searchRules({
        ...query,
        limit: perTypeLimit,
        offset: filters.offset,
      }),
      this.searchCases(filters),
      this.searchRepository.searchRegulations({
        ...query,
        jurisdiction: filters.jurisdiction ?? filters.countryId,
        limit: perTypeLimit,
        offset: filters.offset,
      }),
    ]);

    const items = [...rules.items, ...cases.items, ...regulations.items].slice(
      0,
      filters.limit,
    );

    return {
      items,
      total: rules.total + cases.total + regulations.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  private async searchCases(filters: KosSearchFilters): Promise<KosSearchResult> {
    const dbResult = await this.searchRepository.searchCasesInDb(this.withoutType(filters));
    if (dbResult.total > 0) {
      return dbResult;
    }
    return this.searchCasesFromJson(filters);
  }

  private async searchCasesFromJson(
    filters: KosSearchFilters,
  ): Promise<KosSearchResult> {
    let entries = await this.caseStore.listManifest();

    if (filters.countryId) {
      entries = entries.filter((entry) => entry.country_id === filters.countryId);
    }
    if (filters.categoryId) {
      entries = entries.filter((entry) => entry.category_id === filters.categoryId);
    }
    if (filters.q) {
      entries = await this.filterCasesByKeyword(entries, filters.q);
    }

    entries.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    const total = entries.length;
    const slice = entries.slice(filters.offset, filters.offset + filters.limit);
    const items = await Promise.all(slice.map((entry) => this.toCaseHit(entry)));

    return {
      items,
      total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  private async filterCasesByKeyword(
    entries: CaseManifestEntry[],
    q: string,
  ): Promise<CaseManifestEntry[]> {
    const needle = q.toLowerCase();
    const matched: CaseManifestEntry[] = [];

    for (const entry of entries) {
      if (
        entry.case_id.toLowerCase().includes(needle) ||
        entry.review_id.toLowerCase().includes(needle)
      ) {
        matched.push(entry);
        continue;
      }

      const record = await this.caseStore.findByCaseId(entry.case_id);
      if (!record) {
        continue;
      }

      const haystacks = [
        record.advertisement.content.text,
        record.decision.rationale,
        ...record.matched_rules.map((finding) => finding.summary),
      ];

      if (haystacks.some((text) => text.toLowerCase().includes(needle))) {
        matched.push(entry);
      }
    }

    return matched;
  }

  private async toCaseHit(entry: CaseManifestEntry): Promise<KosSearchHit> {
    const record = await this.caseStore.findByCaseId(entry.case_id);
    const snippet = record?.advertisement.content.text.slice(0, 160);

    return {
      objectType: 'case',
      objectId: entry.case_id,
      title: entry.case_id,
      snippet,
      meta: {
        review_id: entry.review_id,
        country_id: entry.country_id,
        category_id: entry.category_id,
        final_decision: entry.final_decision,
        lifecycle_status: entry.lifecycle_status,
        source: 'json',
      },
    };
  }
}
