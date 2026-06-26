import type {
  CaseEmbeddingRecord,
  CaseManifestEntry,
  CasePrecedent,
  CaseRetrievalResult,
  ICaseEmbeddingRepository,
  ICaseStore,
  IEmbeddingProvider,
  ReviewContext,
} from '@aairp/shared-kernel';
import {
  buildReviewContextEmbedText,
  computeHybridRetrievalScore,
  cosineSimilarity,
  isCaseVectorRetrievalEnabled,
  resolveCaseEmbeddingModel,
} from '@aairp/shared-kernel';

export type CaseRetrievalConfig = {
  limit?: number;
  now?: () => Date;
};

export type CaseRetrievalDeps = {
  embeddingRepository?: ICaseEmbeddingRepository;
  embeddingProvider?: IEmbeddingProvider;
};

export type CaseRetrievalOptions = {
  ruleRefIds?: string[];
  playbookRefIds?: string[];
};

const ACTIVE_STATUSES = new Set(['GENERATED', 'PENDING_HUMAN', 'CONFIRMED', 'DISPUTED']);

function scoreFacetPrecedent(context: ReviewContext, entry: CaseManifestEntry): {
  precedent: CasePrecedent;
  facetScore: number;
} | null {
  if (!ACTIVE_STATUSES.has(entry.lifecycle_status)) {
    return null;
  }

  let facetScore = 0;
  let matchReason = 'dimension match';

  if (entry.content_hash === context.contentHash) {
    facetScore = 1;
    matchReason = 'exact content hash match';
  } else {
    if (entry.country_id !== context.dimensions.countryId) {
      return null;
    }
    if (entry.category_id !== context.dimensions.categoryId) {
      return null;
    }
    facetScore = 0.5;
    if (entry.platform_id === context.dimensions.platformId) {
      facetScore += 0.15;
      matchReason = 'country, category, and platform match';
    }
    if (entry.lifecycle_status === 'CONFIRMED') {
      facetScore += 0.1;
    }
  }

  return {
    facetScore: Math.min(facetScore, 1),
    precedent: {
      case_id: entry.case_id,
      case_version: entry.case_version,
      lifecycle_status: entry.lifecycle_status,
      final_decision: entry.final_decision,
      similarity_score: Math.min(facetScore, 1),
      match_reason: matchReason,
      summary: `Prior review ${entry.review_id} reached ${entry.final_decision} (${entry.lifecycle_status})`,
    },
  };
}

function computeRuleOverlapScore(
  currentRuleRefIds: string[],
  candidateRuleRefIds: string[],
): number {
  if (currentRuleRefIds.length === 0 || candidateRuleRefIds.length === 0) {
    return 0;
  }
  const current = new Set(currentRuleRefIds);
  const overlap = candidateRuleRefIds.filter((refId) => current.has(refId)).length;
  return overlap / currentRuleRefIds.length;
}

function buildEmbeddingMap(records: CaseEmbeddingRecord[]): Map<string, CaseEmbeddingRecord> {
  return new Map(records.map((record) => [record.case_id, record]));
}

export class CaseRetrievalService {
  constructor(
    private readonly caseStore: ICaseStore,
    private readonly config: CaseRetrievalConfig = {},
    private readonly deps: CaseRetrievalDeps = {},
  ) {}

  async retrieve(
    context: ReviewContext,
    options: CaseRetrievalOptions = {},
  ): Promise<CaseRetrievalResult> {
    const limit = this.config.limit ?? 5;
    const ruleRefIds = options.ruleRefIds ?? [];
    const playbookRefIds = options.playbookRefIds ?? [];
    const useVector =
      isCaseVectorRetrievalEnabled() &&
      this.deps.embeddingRepository &&
      this.deps.embeddingProvider;

    const candidates = await this.loadCandidates(context, limit);
    const filtered = candidates.filter((entry) => entry.review_id !== context.reviewId);

    if (!useVector) {
      return this.buildFacetResult(context, filtered, limit);
    }

    return this.buildHybridResult(context, filtered, limit, ruleRefIds, playbookRefIds);
  }

  private async loadCandidates(context: ReviewContext, limit: number): Promise<CaseManifestEntry[]> {
    const hashCandidates = await this.caseStore.search({
      country_id: context.dimensions.countryId,
      category_id: context.dimensions.categoryId,
      platform_id: context.dimensions.platformId,
      content_hash: context.contentHash,
      limit: limit * 8,
    });

    if (hashCandidates.length > 0) {
      return hashCandidates;
    }

    return this.caseStore.search({
      country_id: context.dimensions.countryId,
      category_id: context.dimensions.categoryId,
      platform_id: context.dimensions.platformId,
      limit: limit * 8,
    });
  }

  private buildFacetResult(
    context: ReviewContext,
    candidates: CaseManifestEntry[],
    limit: number,
  ): CaseRetrievalResult {
    const precedents = candidates
      .map((entry) => scoreFacetPrecedent(context, entry))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((left, right) => right.precedent.similarity_score - left.precedent.similarity_score)
      .slice(0, limit)
      .map((entry) => entry.precedent);

    return this.finalizeResult(context.reviewId, precedents, 'facet+hash_v1');
  }

  private async buildHybridResult(
    context: ReviewContext,
    candidates: CaseManifestEntry[],
    limit: number,
    ruleRefIds: string[],
    playbookRefIds: string[],
  ): Promise<CaseRetrievalResult> {
    const provider = this.deps.embeddingProvider!;
    const repository = this.deps.embeddingRepository!;
    const model = resolveCaseEmbeddingModel();
    const queryText = buildReviewContextEmbedText(context, ruleRefIds, playbookRefIds);
    const queryEmbedding = provider.embed(queryText);
    const embeddings = buildEmbeddingMap(
      await repository.findByCaseIds(
        candidates.map((entry) => entry.case_id),
        model,
      ),
    );

    const scored = [];
    for (const entry of candidates) {
      const facet = scoreFacetPrecedent(context, entry);
      if (!facet) {
        continue;
      }

      const caseRecord = await this.caseStore.findByCaseId(entry.case_id);
      const candidateRuleRefIds =
        caseRecord?.matched_rules.map((finding) => finding.ref_id) ?? [];
      const ruleOverlapScore = computeRuleOverlapScore(ruleRefIds, candidateRuleRefIds);
      const caseEmbedding = embeddings.get(entry.case_id);
      const semanticScore = caseEmbedding
        ? cosineSimilarity(queryEmbedding, caseEmbedding.embedding)
        : 0;
      const hybridScore = computeHybridRetrievalScore({
        semanticScore,
        facetScore: facet.facetScore,
        ruleOverlapScore,
      });

      scored.push({
        ...facet.precedent,
        similarity_score: hybridScore,
        match_reason:
          semanticScore > 0
            ? `hybrid vector+facet (semantic=${semanticScore.toFixed(2)})`
            : facet.precedent.match_reason,
      });
    }

    const precedents = scored
      .sort((left, right) => right.similarity_score - left.similarity_score)
      .slice(0, limit);

    return this.finalizeResult(context.reviewId, precedents, 'filter+vector+hybrid_v1');
  }

  private finalizeResult(
    reviewId: string,
    precedents: CasePrecedent[],
    retrievalStrategy: string,
  ): CaseRetrievalResult {
    const exactContentHashMatch = precedents.some(
      (precedent) => precedent.match_reason === 'exact content hash match',
    );
    const coverageScore =
      precedents.length === 0
        ? 0
        : Math.max(...precedents.map((precedent) => precedent.similarity_score));

    return {
      review_id: reviewId,
      precedents,
      exact_content_hash_match: exactContentHashMatch,
      coverage_score: coverageScore,
      retrieval_strategy: retrievalStrategy,
      retrieved_at: (this.config.now ?? (() => new Date()))().toISOString(),
    };
  }
}
