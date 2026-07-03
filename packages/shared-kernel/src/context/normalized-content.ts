import type { ImageContentBlockHint, ImageSlice } from '../findings/image-slice.js';

export type NormalizedContent = {
  text: string;
  ocrText?: string;
  /** Fetched landing page body; unset in Happy Path until Content Normalization. */
  landingPageText?: string;
  /** Source URL only; not evaluated as page text by downstream modules in Happy Path. */
  landingUrl?: string;
  imageUrls: string[];
  language?: string;
  /** Per-image dimensions when known (width × height in pixels). */
  imageDimensions?: Array<{ width: number; height: number } | undefined>;
  /** Optional detected or supplied content-block hints for slice planning. */
  imageContentBlockHints?: ImageContentBlockHint[][];
  /** Manual slice manifest override; bypasses automatic planner when set for an image. */
  sliceManifestOverrides?: ImageSlice[][];
};
