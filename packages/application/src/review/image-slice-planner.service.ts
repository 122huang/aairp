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
  'specs',
  'certification',
];

const DEFAULT_FIXED_HEIGHT_RATIO = 0.25;
const MAX_FIXED_HEIGHT_SLICES = 8;
const LONG_IMAGE_ASPECT_RATIO = 2;

export type ImageSlicePlannerConfig = {
  fixedHeightRatio?: number;
  maxFixedHeightSlices?: number;
  longImageAspectRatio?: number;
  createSliceId?: () => string;
};

function defaultProportionalBlocks(): ImageContentBlockHint[] {
  return [
    { blockType: 'hero', yStart: 0, yEnd: 0.25 },
    { blockType: 'claims', yStart: 0.25, yEnd: 0.5 },
    { blockType: 'specs', yStart: 0.5, yEnd: 0.75 },
    { blockType: 'certification', yStart: 0.75, yEnd: 1 },
  ];
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

function buildFixedHeightFallbackSlices(
  sourceImageIndex: number,
  ratio: number,
  maxSlices: number,
): ImageSlice[] {
  const slices: ImageSlice[] = [];
  let yStart = 0;
  let sliceIndex = 0;

  while (yStart < 1 && sliceIndex < maxSlices) {
    const yEnd = Math.min(1, yStart + ratio);
    slices.push(
      toSlice(
        sourceImageIndex,
        sliceIndex,
        'unknown',
        yStart,
        yEnd,
        'fixed_height_band',
      ),
    );
    if (yEnd >= 1) {
      break;
    }
    yStart = yEnd;
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

export class ImageSlicePlannerService {
  constructor(private readonly config: ImageSlicePlannerConfig = {}) {}

  plan(request: ImageSlicePlannerRequest): ImageSliceManifest[] {
    const fixedHeightRatio = this.config.fixedHeightRatio ?? DEFAULT_FIXED_HEIGHT_RATIO;
    const maxFixedHeightSlices = this.config.maxFixedHeightSlices ?? MAX_FIXED_HEIGHT_SLICES;
    const longImageAspectRatio = this.config.longImageAspectRatio ?? LONG_IMAGE_ASPECT_RATIO;

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

export { CONTENT_BLOCK_ORDER, DEFAULT_FIXED_HEIGHT_RATIO, MAX_FIXED_HEIGHT_SLICES };
