import { randomUUID } from 'node:crypto';
import type { IAdvertisementRepository, NormalizedAdvertisement } from '@aairp/domain';
import type {
  ResolvedKnowledgeVersions,
  ReviewContext,
} from '@aairp/shared-kernel';

export const DEMO_KNOWLEDGE_VERSIONS: ResolvedKnowledgeVersions = {
  rulePackVersion: 'demo-rule-1.8.7',
  policyPackVersion: 'demo-policy-1.0.0',
  playbookPackVersion: 'demo-playbook-1.7.1',
};

export type ContextBuilderConfig = {
  knowledgeVersions?: ResolvedKnowledgeVersions;
  now?: () => Date;
  createReviewId?: () => string;
};

export class AdvertisementNotFoundError extends Error {
  constructor(public readonly advertisementId: string) {
    super(`advertisement not found: ${advertisementId}`);
    this.name = 'AdvertisementNotFoundError';
  }
}

export class ContextBuilderService {
  constructor(
    private readonly advertisementRepository: IAdvertisementRepository,
    private readonly config: ContextBuilderConfig = {},
  ) {}

  async buildFromAdvertisementId(advertisementId: string): Promise<ReviewContext> {
    const advertisement = await this.advertisementRepository.findById(advertisementId);
    if (!advertisement) {
      throw new AdvertisementNotFoundError(advertisementId);
    }
    return this.buildFromAdvertisement(advertisement);
  }

  buildFromAdvertisement(advertisement: NormalizedAdvertisement): ReviewContext {
    const builtAt = (this.config.now ?? (() => new Date()))().toISOString();
    const reviewId = `rev_${(this.config.createReviewId ?? randomUUID)()}`;

    return {
      reviewId,
      advertisementId: advertisement.advertisementId,
      contentHash: advertisement.contentHash,
      contentVersion: advertisement.contentVersion,
      dimensions: {
        tenantId: advertisement.tenantId,
        countryId: advertisement.countryId,
        platformId: advertisement.platformId,
        categoryId: advertisement.categoryId,
      },
      normalizedContent: this.buildNormalizedContent(advertisement),
      resolvedKnowledgeVersions: this.resolveKnowledgeVersions(),
      advertisementContext: advertisement.context,
      tags: advertisement.tags,
      builtAt,
    };
  }

  private buildNormalizedContent(
    advertisement: NormalizedAdvertisement,
  ): ReviewContext['normalizedContent'] {
    return {
      text: advertisement.content.text,
      imageUrls: advertisement.content.images,
      ...(advertisement.content.ocrText
        ? { ocrText: advertisement.content.ocrText }
        : {}),
      ...(advertisement.content.disclaimerText
        ? { disclaimerText: advertisement.content.disclaimerText }
        : {}),
      ...(advertisement.content.landingUrl
        ? { landingUrl: advertisement.content.landingUrl }
        : {}),
    };
  }

  // Resolved from IKnowledgeGateway via bootstrapReviewRuntime(); demo constants are the fallback.
  private resolveKnowledgeVersions(): ResolvedKnowledgeVersions {
    return this.config.knowledgeVersions ?? DEMO_KNOWLEDGE_VERSIONS;
  }
}
