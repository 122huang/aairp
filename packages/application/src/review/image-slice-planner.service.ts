import type {
  ImageContentBlockHint,
  ImageSlice,
  ImageSliceManifest,
  ImageSlicePlannerRequest,
  ImageSliceType,
} from '@aairp/shared-kernel';

const CONTENT_BLOCK_ORDER: Exclude<ImageSliceType, 'unknown'>[] = [
  'hero',
  'claims',
  'lifestyle',
  'specs',
  'comparison',
  'certification',
  'footer',
];

const DEFAULT_FIXED_HEIGHT_RATIO = 0.25;
const MAX_FIXED_HEIGHT_SLICES = 8;
const LONG_IMAGE_ASPECT_RATIO = 2;
const DEFAULT_SLICE_HEIGHT_PX = 2000;
const MIN_HEIGHT_FOR_PIXEL_SLICING_PX = 2000;
/** Sprint 6A / ADR-005: ~10% vertical overlap so badges/claims are not cut at band edges. */
const DEFAULT_SLICE_OVERLAP_RATIO = 0.1;
const DEFAULT_MAX_PIXEL_HEIGHT_SLICES = 8;

export type ImageSlicePlannerConfig = {
  fixedHeightRatio?: number;
  maxFixedHeightSlices?: number;
  longImageAspectRatio?: number;
  sliceHeightPx?: number;
  minHeightForPixelSlicingPx?: number;
  /** Overlap as a fraction of each band height (0–0.5). Default 0.1. */
  sliceOverlapRatio?: number;
  /** Cap for fixed-pixel long-image bands (`VISION_MAX_SLICES_PER_IMAGE`). Default 8. */
  maxPixelHeightSlices?: number;
  createSliceId?: () => string;
};

function defaultProportionalBlocks(): ImageContentBlockHint[] {
  const n = CONTENT_BLOCK_ORDER.length;
  const step = 1 / n;
  return CONTENT_BLOCK_ORDER.map((blockType, index) => ({
    blockType,
    yStart: index * step,
    yEnd: Math.min(1, (index + 1) * step),
  }));
}

function toSlice(
  sourceImageIndex: number,
  sliceIndex: number,
  sliceType: ImageSliceType,
  yStart: number,
  yEnd: number,
  plannerHint?: string,
): ImageSlice {
  return {
    sliceId: `img${sourceImageIndex}-s${sliceIndex}-${sliceType}`,
    sourceImageIndex,
    sliceIndex,
    sliceType,
    yStart,
    yEnd,
    bbox: { x: 0, y: yStart, w: 1, h: yEnd - yStart },
    ...(plannerHint ? { plannerHint } : {}),
  };
}

function buildContentBlockSlices(
  sourceImageIndex: number,
  blocks: ImageContentBlockHint[],
  plannerHint: string,
): ImageSlice[] {
  return blocks.map((block, index) =>
    toSlice(sourceImageIndex, index, block.blockType, block.yStart, block.yEnd, plannerHint),
  );
}

function clampOverlapRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 0;
  }
  return Math.min(0.5, ratio);
}

/**
 * Fixed-ratio bands with optional overlap. When capping, stride shrinks so the
 * full [0,1] height is still covered.
 */
function buildFixedHeightFallbackSlices(
  sourceImageIndex: number,
  ratio: number,
  maxSlices: number,
  overlapRatio: number,
): ImageSlice[] {
  const overlap = clampOverlapRatio(overlapRatio);
  const band = Math.min(1, Math.max(ratio, 1 / maxSlices));
  const stride = Math.max(band * (1 - overlap), band / maxSlices);
  const slices: ImageSlice[] = [];
  let yStart = 0;
  let sliceIndex = 0;

  while (yStart < 1 && sliceIndex < maxSlices) {
    const yEnd = Math.min(1, yStart + band);
    slices.push(
      toSlice(
        sourceImageIndex,
        sliceIndex,
        'unknown',
        yStart,
        yEnd,
        overlap > 0 ? 'fixed_height_band_overlap' : 'fixed_height_band',
      ),
    );
    if (yEnd >= 1) {
      break;
    }
    yStart = yStart + stride;
    if (sliceIndex === maxSlices - 2 && yStart + band < 1) {
      yStart = Math.max(0, 1 - band);
    }
    sliceIndex += 1;
  }

  return slices;
}

/**
 * Fixed pixel-height windows with overlap + max-slice cap (ADR-005 / Sprint 6A-2).
 */
function buildFixedPixelHeightSlices(
  sourceImageIndex: number,
  heightPx: number,
  sliceHeightPx: number,
  overlapRatio: number,
  maxSlices: number,
): ImageSlice[] {
  if (heightPx <= 0) {
    return [toSlice(sourceImageIndex, 0, 'unknown', 0, 1, 'fixed_pixel_height_band')];
  }

  const overlapFrac = clampOverlapRatio(overlapRatio);
  let bandPx = Math.max(1, Math.min(sliceHeightPx, heightPx));
  let overlapPx = Math.floor(bandPx * overlapFrac);
  let stridePx = Math.max(1, bandPx - overlapPx);

  const uncappedCount = Math.ceil(Math.max(0, heightPx - bandPx) / stridePx) + 1;
  if (uncappedCount > maxSlices && maxSlices >= 1) {
    if (overlapFrac >= 1) {
      bandPx = heightPx;
      overlapPx = 0;
      stridePx = heightPx;
    } else {
      bandPx = Math.max(
        1,
        Math.ceil(heightPx / (maxSlices * (1 - overlapFrac) + overlapFrac)),
      );
      overlapPx = Math.floor(bandPx * overlapFrac);
      stridePx = Math.max(1, bandPx - overlapPx);
    }
  }

  const slices: ImageSlice[] = [];
  let yStartPx = 0;
  let sliceIndex = 0;

  while (yStartPx < heightPx && sliceIndex < maxSlices) {
    const yEndPx = Math.min(heightPx, yStartPx + bandPx);
    slices.push(
      toSlice(
        sourceImageIndex,
        sliceIndex,
        'unknown',
        yStartPx / heightPx,
        yEndPx / heightPx,
        overlapFrac > 0 ? 'fixed_pixel_height_band_overlap' : 'fixed_pixel_height_band',
      ),
    );
    if (yEndPx >= heightPx) {
      break;
    }
    yStartPx += stridePx;
    if (sliceIndex === maxSlices - 2 && yStartPx + bandPx < heightPx) {
      yStartPx = Math.max(0, heightPx - bandPx);
    }
    sliceIndex += 1;
  }

  return slices;
}

function isLongImage(
  dimensions: { width: number; height: number } | undefined,
  longImageAspectRatio: number,
): boolean {
  if (!dimensions || dimensions.width <= 0) {
    return false;
  }
  return dimensions.height / dimensions.width >= longImageAspectRatio;
}

function resolveMaxPixelHeightSlices(config: ImageSlicePlannerConfig): number {
  if (config.maxPixelHeightSlices !== undefined) {
    return Math.max(1, config.maxPixelHeightSlices);
  }
  const fromEnv = Number(process.env.VISION_MAX_SLICES_PER_IMAGE);
  if (Number.isFinite(fromEnv) && fromEnv >= 1) {
    return Math.floor(fromEnv);
  }
  return DEFAULT_MAX_PIXEL_HEIGHT_SLICES;
}

export class ImageSlicePlannerService {
  constructor(private readonly config: ImageSlicePlannerConfig = {}) {}

  plan(request: ImageSlicePlannerRequest): ImageSliceManifest[] {
    const fixedHeightRatio = this.config.fixedHeightRatio ?? DEFAULT_FIXED_HEIGHT_RATIO;
    const maxFixedHeightSlices = this.config.maxFixedHeightSlices ?? MAX_FIXED_HEIGHT_SLICES;
    const longImageAspectRatio = this.config.longImageAspectRatio ?? LONG_IMAGE_ASPECT_RATIO;
    const sliceHeightPx = this.config.sliceHeightPx ?? DEFAULT_SLICE_HEIGHT_PX;
    const minHeightForPixelSlicingPx =
      this.config.minHeightForPixelSlicingPx ?? MIN_HEIGHT_FOR_PIXEL_SLICING_PX;
    const sliceOverlapRatio = this.config.sliceOverlapRatio ?? DEFAULT_SLICE_OVERLAP_RATIO;
    const maxPixelHeightSlices = resolveMaxPixelHeightSlices(this.config);

    return request.imageUrls.map((imageUrl, sourceImageIndex) => {
      const dimensions = request.dimensionsByImage?.[sourceImageIndex];
      const manualSlices = request.manualManifestByImage?.[sourceImageIndex];
      const contentHints = request.contentBlockHintsByImage?.[sourceImageIndex];

      if (manualSlices && manualSlices.length > 0) {
        return {
          sourceImageIndex,
          imageUrl,
          plannerMode: 'manual' as const,
          slices: manualSlices.map((slice, index) => ({
            ...slice,
            sourceImageIndex,
            sliceIndex: slice.sliceIndex ?? index,
            sliceId: slice.sliceId || `img${sourceImageIndex}-s${index}-${slice.sliceType}`,
          })),
        };
      }

      if (contentHints && contentHints.length > 0) {
        return {
          sourceImageIndex,
          imageUrl,
          plannerMode: 'content_blocks' as const,
          slices: buildContentBlockSlices(
            sourceImageIndex,
            contentHints,
            'provided_content_blocks',
          ),
        };
      }

      if (dimensions && dimensions.height > minHeightForPixelSlicingPx) {
        return {
          sourceImageIndex,
          imageUrl,
          plannerMode: 'fixed_height_fallback' as const,
          fallbackReason: 'pixel_height_band_for_long_image',
          slices: buildFixedPixelHeightSlices(
            sourceImageIndex,
            dimensions.height,
            sliceHeightPx,
            sliceOverlapRatio,
            maxPixelHeightSlices,
          ),
        };
      }

      if (isLongImage(dimensions, longImageAspectRatio)) {
        return {
          sourceImageIndex,
          imageUrl,
          plannerMode: 'content_blocks' as const,
          slices: buildContentBlockSlices(
            sourceImageIndex,
            defaultProportionalBlocks(),
            'proportional_content_blocks',
          ),
        };
      }

      if (dimensions && dimensions.height > dimensions.width) {
        return {
          sourceImageIndex,
          imageUrl,
          plannerMode: 'fixed_height_fallback' as const,
          fallbackReason: 'unable_to_identify_content_blocks_without_aspect_ratio_signal',
          slices: buildFixedHeightFallbackSlices(
            sourceImageIndex,
            fixedHeightRatio,
            maxFixedHeightSlices,
            sliceOverlapRatio,
          ),
        };
      }

      return {
        sourceImageIndex,
        imageUrl,
        plannerMode: 'content_blocks' as const,
        slices: [toSlice(sourceImageIndex, 0, 'hero', 0, 1, 'single_image_hero')],
      };
    });
  }

  planFromNormalizedContent(input: {
    imageUrls: string[];
    imageDimensions?: Array<{ width: number; height: number } | undefined>;
    imageContentBlockHints?: ImageContentBlockHint[][];
    sliceManifestOverrides?: ImageSlice[][];
  }): ImageSliceManifest[] {
    return this.plan({
      imageUrls: input.imageUrls,
      dimensionsByImage: input.imageDimensions,
      contentBlockHintsByImage: input.imageContentBlockHints,
      manualManifestByImage: input.sliceManifestOverrides,
    });
  }
}

export {
  CONTENT_BLOCK_ORDER,
  DEFAULT_FIXED_HEIGHT_RATIO,
  DEFAULT_SLICE_HEIGHT_PX,
  DEFAULT_SLICE_OVERLAP_RATIO,
  DEFAULT_MAX_PIXEL_HEIGHT_SLICES,
  MAX_FIXED_HEIGHT_SLICES,
};
