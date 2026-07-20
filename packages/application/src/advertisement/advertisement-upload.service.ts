import { createHash, randomUUID } from 'node:crypto';
import {
  validateAdvertisementUpload,
  type AdvertisementUploadInput,
  type AdvertisementValidationIssue,
  type IAdvertisementRepository,
  type NormalizedAdvertisement,
} from '@aairp/domain';

export type AdvertisementUploadServiceConfig = {
  defaultTenantId?: string;
  now?: () => Date;
  createId?: () => string;
};

export class AdvertisementUploadService {
  constructor(
    private readonly repository: IAdvertisementRepository,
    private readonly config: AdvertisementUploadServiceConfig = {},
  ) {}

  async upload(payload: unknown): Promise<NormalizedAdvertisement> {
    const validation = validateAdvertisementUpload(
      payload,
      this.config.defaultTenantId ?? 'demo',
    );

    if (!validation.ok) {
      const detail = validation.issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join('; ');
      throw new AdvertisementUploadValidationError(detail, validation.issues);
    }

    const normalized = this.normalize(validation.input);
    return this.repository.save(normalized);
  }

  private normalize(input: AdvertisementUploadInput): NormalizedAdvertisement {
    const uploadedAt = (this.config.now ?? (() => new Date()))().toISOString();

    return {
      advertisementId: `ad_${(this.config.createId ?? randomUUID)()}`,
      ...(input.externalRef ? { externalRef: input.externalRef } : {}),
      tenantId: input.tenantId,
      countryId: input.countryId,
      platformId: input.platformId,
      categoryId: input.categoryId,
      content: input.content,
      context: input.context ?? {},
      tags: input.tags,
      contentHash: this.computeContentHash(input),
      contentVersion: 1,
      parentAdvertisementId: null,
      status: 'PENDING_REVIEW',
      uploadedAt,
    };
  }

  private computeContentHash(input: AdvertisementUploadInput): string {
    const canonical = JSON.stringify({
      text: input.content.text,
      images: input.content.images,
      ...(input.content.landingUrl
        ? { landingUrl: input.content.landingUrl }
        : {}),
      ...(input.content.ocrText !== undefined
        ? { ocrText: input.content.ocrText }
        : {}),
      ...(input.content.disclaimerText
        ? { disclaimerText: input.content.disclaimerText }
        : {}),
    });

    return createHash('sha256').update(canonical).digest('hex');
  }
}

export class AdvertisementUploadValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: AdvertisementValidationIssue[],
  ) {
    super(message);
    this.name = 'AdvertisementUploadValidationError';
  }
}
