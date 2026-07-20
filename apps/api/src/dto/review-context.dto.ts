import type { ReviewContext } from '@aairp/shared-kernel';

export type BuildReviewContextRequestDto = {
  advertisement_id: string;
};

export type ReviewContextResponseDto = {
  review_id: string;
  advertisement_id: string;
  content_hash: string;
  content_version: number;
  dimensions: {
    tenant_id: string;
    country_id: string;
    platform_id: string;
    category_id: string;
  };
  normalized_content: {
    text: string;
    ocr_text?: string;
    disclaimer_text?: string;
    landing_page_text?: string;
    image_urls: string[];
    language?: string;
  };
  resolved_knowledge_versions: {
    rule_pack_version: string;
    policy_pack_version: string;
    playbook_pack_version: string;
  };
  advertisement_context: {
    campaign_type?: string;
    ad_format?: string;
    target_audience?: string;
    product_sku?: string;
    ai_rendered_image?: boolean;
    certification_image_unreadable?: boolean;
    ai_image_quality_issue?: boolean;
  };
  tags: string[];
  built_at: string;
};

export function toReviewContextResponseDto(
  context: ReviewContext,
): ReviewContextResponseDto {
  return {
    review_id: context.reviewId,
    advertisement_id: context.advertisementId,
    content_hash: context.contentHash,
    content_version: context.contentVersion,
    dimensions: {
      tenant_id: context.dimensions.tenantId,
      country_id: context.dimensions.countryId,
      platform_id: context.dimensions.platformId,
      category_id: context.dimensions.categoryId,
    },
    normalized_content: {
      text: context.normalizedContent.text,
      image_urls: context.normalizedContent.imageUrls,
      ...(context.normalizedContent.ocrText
        ? { ocr_text: context.normalizedContent.ocrText }
        : {}),
      ...(context.normalizedContent.disclaimerText
        ? { disclaimer_text: context.normalizedContent.disclaimerText }
        : {}),
      ...(context.normalizedContent.landingPageText
        ? { landing_page_text: context.normalizedContent.landingPageText }
        : context.normalizedContent.landingUrl
          ? { landing_page_text: context.normalizedContent.landingUrl }
          : {}),
      ...(context.normalizedContent.language
        ? { language: context.normalizedContent.language }
        : {}),
    },
    resolved_knowledge_versions: {
      rule_pack_version: context.resolvedKnowledgeVersions.rulePackVersion,
      policy_pack_version: context.resolvedKnowledgeVersions.policyPackVersion,
      playbook_pack_version: context.resolvedKnowledgeVersions.playbookPackVersion,
    },
    advertisement_context: {
      ...(context.advertisementContext.campaignType
        ? { campaign_type: context.advertisementContext.campaignType }
        : {}),
      ...(context.advertisementContext.adFormat
        ? { ad_format: context.advertisementContext.adFormat }
        : {}),
      ...(context.advertisementContext.targetAudience
        ? { target_audience: context.advertisementContext.targetAudience }
        : {}),
      ...(context.advertisementContext.productSku
        ? { product_sku: context.advertisementContext.productSku }
        : {}),
      ...(context.advertisementContext.aiRenderedImage
        ? { ai_rendered_image: true }
        : {}),
      ...(context.advertisementContext.certificationImageUnreadable
        ? { certification_image_unreadable: true }
        : {}),
      ...(context.advertisementContext.aiImageQualityIssue
        ? { ai_image_quality_issue: true }
        : {}),
    },
    tags: context.tags,
    built_at: context.builtAt,
  };
}
