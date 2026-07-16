import type {
  AdvertisementContent,
  AdvertisementContext,
  AdvertisementUploadInput,
} from './advertisement.types.js';

export type AdvertisementValidationIssue = {
  field: string;
  message: string;
};

export type AdvertisementUploadPayload = {
  external_ref?: string;
  tenant_id?: string;
  country_id?: string;
  platform_id?: string;
  category_id?: string;
  content?: {
    text?: string;
    images?: string[];
    landing_url?: string;
    ocr_text?: string;
  };
  context?: {
    campaign_type?: string;
    ad_format?: string;
    ad_type?: string;
    target_audience?: string;
    product_sku?: string;
    ai_rendered_image?: boolean;
    certification_image_unreadable?: boolean;
    ai_image_quality_issue?: boolean;
  };
  tags?: string[];
};

export type ValidateAdvertisementUploadResult =
  | { ok: true; input: AdvertisementUploadInput }
  | { ok: false; issues: AdvertisementValidationIssue[] };

export const UPLOAD_LIMITS = {
  MAX_TEXT_LENGTH: 65536,
  MAX_IMAGES: 10,
  MAX_URL_LENGTH: 2048,
  MAX_IMAGE_DATA_URL_LENGTH: 15 * 1024 * 1024,
} as const;

function isImageDataUrl(value: string): boolean {
  return /^data:image\/[a-z0-9+.-]+;base64,/i.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeContent(raw: AdvertisementUploadPayload['content']): {
  content?: AdvertisementContent;
  issues: AdvertisementValidationIssue[];
} {
  const issues: AdvertisementValidationIssue[] = [];

  if (!raw || typeof raw !== 'object') {
    issues.push({ field: 'content', message: 'content is required' });
    return { issues };
  }

  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  const images = Array.isArray(raw.images)
    ? raw.images.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  if (!text && images.length === 0) {
    issues.push({
      field: 'content',
      message: 'content.text or content.images is required',
    });
  }

  if (text.length > UPLOAD_LIMITS.MAX_TEXT_LENGTH) {
    issues.push({
      field: 'content.text',
      message: `must not exceed ${UPLOAD_LIMITS.MAX_TEXT_LENGTH} characters`,
    });
  }

  if (images.length > UPLOAD_LIMITS.MAX_IMAGES) {
    issues.push({
      field: 'content.images',
      message: `must not exceed ${UPLOAD_LIMITS.MAX_IMAGES} items`,
    });
  }

  for (const [index, imageUrl] of images.entries()) {
    if (isImageDataUrl(imageUrl)) {
      if (imageUrl.length > UPLOAD_LIMITS.MAX_IMAGE_DATA_URL_LENGTH) {
        issues.push({
          field: `content.images[${index}]`,
          message: `base64 image must not exceed ${UPLOAD_LIMITS.MAX_IMAGE_DATA_URL_LENGTH} characters`,
        });
      }
      continue;
    }

    if (imageUrl.length > UPLOAD_LIMITS.MAX_URL_LENGTH) {
      issues.push({
        field: `content.images[${index}]`,
        message: `must not exceed ${UPLOAD_LIMITS.MAX_URL_LENGTH} characters`,
      });
    }
  }

  if (raw.landing_url !== undefined && !isNonEmptyString(raw.landing_url)) {
    issues.push({ field: 'content.landing_url', message: 'must be a non-empty string' });
  } else if (
    raw.landing_url &&
    raw.landing_url.trim().length > UPLOAD_LIMITS.MAX_URL_LENGTH
  ) {
    issues.push({
      field: 'content.landing_url',
      message: `must not exceed ${UPLOAD_LIMITS.MAX_URL_LENGTH} characters`,
    });
  }

  if (raw.ocr_text !== undefined && typeof raw.ocr_text !== 'string') {
    issues.push({ field: 'content.ocr_text', message: 'must be a string' });
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    content: {
      text,
      images,
      ...(raw.landing_url ? { landingUrl: raw.landing_url.trim() } : {}),
      ...(raw.ocr_text !== undefined ? { ocrText: raw.ocr_text.trim() } : {}),
    },
    issues: [],
  };
}

function normalizeContext(
  raw: AdvertisementUploadPayload['context'],
): AdvertisementContext {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return {
    ...(isNonEmptyString(raw.campaign_type)
      ? { campaignType: raw.campaign_type.trim() }
      : {}),
    ...(isNonEmptyString(raw.ad_format) ? { adFormat: raw.ad_format.trim() } : {}),
    ...(isNonEmptyString(raw.ad_type) ? { adType: raw.ad_type.trim().toUpperCase() } : {}),
    ...(isNonEmptyString(raw.target_audience)
      ? { targetAudience: raw.target_audience.trim() }
      : {}),
    ...(isNonEmptyString(raw.product_sku) ? { productSku: raw.product_sku.trim() } : {}),
    ...(raw.ai_rendered_image === true ? { aiRenderedImage: true } : {}),
    ...(raw.certification_image_unreadable === true
      ? { certificationImageUnreadable: true }
      : {}),
    ...(raw.ai_image_quality_issue === true ? { aiImageQualityIssue: true } : {}),
  };
}

// Demo-only: tenant_id is client-supplied when present; no auth in Happy Path scope.
export function validateAdvertisementUpload(
  payload: unknown,
  defaultTenantId = 'demo',
): ValidateAdvertisementUploadResult {
  const issues: AdvertisementValidationIssue[] = [];

  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      issues: [{ field: 'body', message: 'request body must be a JSON object' }],
    };
  }

  const raw = payload as AdvertisementUploadPayload;

  if (!isNonEmptyString(raw.country_id)) {
    issues.push({ field: 'country_id', message: 'country_id is required' });
  }
  if (!isNonEmptyString(raw.platform_id)) {
    issues.push({ field: 'platform_id', message: 'platform_id is required' });
  }
  if (!isNonEmptyString(raw.category_id)) {
    issues.push({ field: 'category_id', message: 'category_id is required' });
  }

  const tenantId = isNonEmptyString(raw.tenant_id)
    ? raw.tenant_id.trim()
    : defaultTenantId;

  if (raw.external_ref !== undefined && !isNonEmptyString(raw.external_ref)) {
    issues.push({ field: 'external_ref', message: 'must be a non-empty string' });
  }

  if (raw.tags !== undefined && !Array.isArray(raw.tags)) {
    issues.push({ field: 'tags', message: 'must be an array of strings' });
  }

  const tags =
    Array.isArray(raw.tags)
      ? raw.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [];

  const { content, issues: contentIssues } = normalizeContent(raw.content);
  issues.push(...contentIssues);

  if (issues.length > 0 || !content) {
    return { ok: false, issues };
  }

  const input: AdvertisementUploadInput = {
    ...(raw.external_ref ? { externalRef: raw.external_ref.trim() } : {}),
    tenantId,
    countryId: raw.country_id!.trim().toUpperCase(),
    platformId: raw.platform_id!.trim().toUpperCase(),
    categoryId: raw.category_id!.trim().toLowerCase(),
    content,
    context: normalizeContext(raw.context),
    tags,
  };

  return { ok: true, input };
}
