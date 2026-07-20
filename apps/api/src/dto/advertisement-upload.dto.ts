import type { NormalizedAdvertisement } from '@aairp/domain';

export type AdvertisementUploadResponseDto = {
  advertisement_id: string;
  external_ref?: string;
  tenant_id: string;
  country_id: string;
  platform_id: string;
  category_id: string;
  content: {
    text: string;
    images: string[];
    landing_url?: string;
    ocr_text?: string;
    disclaimer_text?: string;
  };
  context: {
    campaign_type?: string;
    ad_format?: string;
    ad_type?: string;
    target_audience?: string;
    product_sku?: string;
    ai_rendered_image?: boolean;
  };
  tags: string[];
  content_hash: string;
  content_version: number;
  parent_advertisement_id: null;
  status: 'PENDING_REVIEW';
  uploaded_at: string;
};

export function toAdvertisementUploadResponseDto(
  advertisement: NormalizedAdvertisement,
): AdvertisementUploadResponseDto {
  return {
    advertisement_id: advertisement.advertisementId,
    ...(advertisement.externalRef ? { external_ref: advertisement.externalRef } : {}),
    tenant_id: advertisement.tenantId,
    country_id: advertisement.countryId,
    platform_id: advertisement.platformId,
    category_id: advertisement.categoryId,
    content: {
      text: advertisement.content.text,
      images: advertisement.content.images,
      ...(advertisement.content.landingUrl
        ? { landing_url: advertisement.content.landingUrl }
        : {}),
      ...(advertisement.content.ocrText
        ? { ocr_text: advertisement.content.ocrText }
        : {}),
      ...(advertisement.content.disclaimerText
        ? { disclaimer_text: advertisement.content.disclaimerText }
        : {}),
    },
    context: {
      ...(advertisement.context.campaignType
        ? { campaign_type: advertisement.context.campaignType }
        : {}),
      ...(advertisement.context.adFormat
        ? { ad_format: advertisement.context.adFormat }
        : {}),
      ...(advertisement.context.adType
        ? { ad_type: advertisement.context.adType }
        : {}),
      ...(advertisement.context.targetAudience
        ? { target_audience: advertisement.context.targetAudience }
        : {}),
      ...(advertisement.context.productSku
        ? { product_sku: advertisement.context.productSku }
        : {}),
      ...(advertisement.context.aiRenderedImage
        ? { ai_rendered_image: true }
        : {}),
      ...(advertisement.context.certificationImageUnreadable
        ? { certification_image_unreadable: true }
        : {}),
      ...(advertisement.context.aiImageQualityIssue
        ? { ai_image_quality_issue: true }
        : {}),
    },
    tags: advertisement.tags,
    content_hash: advertisement.contentHash,
    content_version: advertisement.contentVersion,
    parent_advertisement_id: advertisement.parentAdvertisementId,
    status: advertisement.status,
    uploaded_at: advertisement.uploadedAt,
  };
}
