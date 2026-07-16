import type { NormalizedContent } from './normalized-content.js';
import type { ResolvedKnowledgeVersions } from './resolved-knowledge-versions.js';

export type ReviewDimensions = {
  tenantId: string;
  countryId: string;
  platformId: string;
  categoryId: string;
};

export type ReviewContext = {
  reviewId: string;
  advertisementId: string;
  contentHash: string;
  contentVersion: number;
  dimensions: ReviewDimensions;
  normalizedContent: NormalizedContent;
  resolvedKnowledgeVersions: ResolvedKnowledgeVersions;
  advertisementContext: {
    campaignType?: string;
    adFormat?: string;
    /**
     * INFLUENCER_UGC | BRAND_PRODUCT | unset.
     * Disclosure rules use this for when-gating (see RuleWhenCondition.ad_type_in).
     */
    adType?: string;
    targetAudience?: string;
    productSku?: string;
    aiRenderedImage?: boolean;
    certificationImageUnreadable?: boolean;
    aiImageQualityIssue?: boolean;
  };
  tags: string[];
  builtAt: string;
};
