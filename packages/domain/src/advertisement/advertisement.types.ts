export type AdvertisementContent = {
  text: string;
  images: string[];
  landingUrl?: string;
  ocrText?: string;
};

export type AdvertisementContext = {
  campaignType?: string;
  adFormat?: string;
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
