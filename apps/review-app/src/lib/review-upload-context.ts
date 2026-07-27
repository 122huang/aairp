import type { ReviewUploadPayload } from '@/api/review';
import type { AdTypeValue } from '@/lib/ad-type-copy';

/** Optional review context fields sent with demo review upload. */
export function buildReviewUploadContext(
  adType: AdTypeValue,
  productSku: string,
): ReviewUploadPayload['context'] | undefined {
  const sku = productSku.trim();
  const context: NonNullable<ReviewUploadPayload['context']> = {};
  if (adType) context.ad_type = adType;
  if (sku) context.product_sku = sku;
  return Object.keys(context).length > 0 ? context : undefined;
}

export function resolveCaseProductSku(record: {
  context_builder_output?: { advertisement_context?: { productSku?: string } };
}): string {
  return record.context_builder_output?.advertisement_context?.productSku?.trim() ?? '';
}
