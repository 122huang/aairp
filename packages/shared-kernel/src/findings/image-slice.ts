export type ImageSliceType = 'hero' | 'claims' | 'specs' | 'certification' | 'unknown';

export type ImageSliceBBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ImageSlice = {
  sliceId: string;
  sourceImageIndex: number;
  sliceIndex: number;
  sliceType: ImageSliceType;
  yStart: number;
  yEnd: number;
  bbox?: ImageSliceBBox;
  plannerHint?: string;
};

export type ImageSlicePlannerMode = 'content_blocks' | 'manual' | 'fixed_height_fallback';

export type ImageSliceManifest = {
  sourceImageIndex: number;
  imageUrl: string;
  plannerMode: ImageSlicePlannerMode;
  fallbackReason?: string;
  slices: ImageSlice[];
};

export type ImageContentBlockHint = {
  blockType: Exclude<ImageSliceType, 'unknown'>;
  yStart: number;
  yEnd: number;
};

export type ImageSlicePlannerRequest = {
  imageUrls: string[];
  dimensionsByImage?: Array<{ width: number; height: number } | undefined>;
  contentBlockHintsByImage?: ImageContentBlockHint[][];
  manualManifestByImage?: ImageSlice[][];
};
