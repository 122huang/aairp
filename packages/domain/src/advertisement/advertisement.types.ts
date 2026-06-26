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
