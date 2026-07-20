export type AdvertisementContent = {
  text: string;
  images: string[];
  landingUrl?: string;
  ocrText?: string;
  /**
   * Explicit footnote / disclaimer / claim-qualifier copy (e.g. "*Compared with…").
   * Persisted separately from `text` so compliance judgment does not rely on
   * parsing hidden structure out of the main headline blob.
   */
  disclaimerText?: string;
};

export type AdvertisementContext = {
  campaignType?: string;
  adFormat?: string;
  /**
   * Content class for disclosure gating.
   * - INFLUENCER_UGC: paid/gifted/KOL-style content — disclosure rules apply
   * - BRAND_PRODUCT: brand-owned product copy — disclosure rules do not apply
   * - unset/UNKNOWN: fall back to activation_terms (gifted/KOL signals) only
   */
  adType?: string;
  targetAudience?: string;
  /** Expected product SKU / model for asset alignment checks */
  productSku?: string;
  /** User or pipeline flag: image is AI-generated / rendered */
  aiRenderedImage?: boolean;
  /** Vision/OCR flag: certification badge in image is illegible */
  certificationImageUnreadable?: boolean;
  /** Vision flag: AI image has distortion or abnormal artifacts */
  aiImageQualityIssue?: boolean;
};

export type AdvertisementUploadInput = {
  externalRef?: string;
  tenantId: string;
  countryId: string;
  platformId: string;
  categoryId: string;
  content: AdvertisementContent;
  context?: AdvertisementContext;
  tags: string[];
};

export type NormalizedAdvertisement = {
  advertisementId: string;
  externalRef?: string;
  tenantId: string;
  countryId: string;
  platformId: string;
  categoryId: string;
  content: AdvertisementContent;
  context: AdvertisementContext;
  tags: string[];
  contentHash: string;
  contentVersion: number;
  parentAdvertisementId: null;
  status: 'PENDING_REVIEW';
  uploadedAt: string;
};
