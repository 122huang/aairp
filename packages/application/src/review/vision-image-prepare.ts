import sharp from 'sharp';
import { loadImageBuffer } from './image-slice-crop.js';

/** Align with OCR long-image-prepare defaults (apps/api). */
const DEFAULT_MAX_WIDTH = 2400;
const DEFAULT_TARGET_NARROW_WIDTH = 1600;
const NARROW_WIDTH_THRESHOLD = 600;
/** Keep preprocess bounded so ultra-tall PDPs do not explode memory/time. */
const DEFAULT_MAX_WORKING_HEIGHT = 18_000;
const NORMALIZE_PIXEL_BUDGET = 8_000_000;

export type VisionImageEnhanceOptions = {
  /** Downscale ceiling for already-wide images. Default 2400. */
  maxWidth?: number;
  /**
   * Target width when source is narrower than `narrowWidthThreshold`.
   * Chat-compressed PDPs (e.g. width 40–400) jump straight to this size.
   * Default 1600.
   */
  targetNarrowWidth?: number;
  /** Width below which we force a strong upscale (not just 1.75×). Default 600. */
  narrowWidthThreshold?: number;
  /** Mild boost for mid-size images below maxWidth. Default 1.75. */
  mildUpscaleFactor?: number;
  /** Cap enhanced height (long PDPs). Default 18000. */
  maxWorkingHeight?: number;
  sharpen?: boolean;
  /** Light contrast normalize for washed-out JPEG compressions (skipped on huge canvases). */
  normalize?: boolean;
};

export type EnhancedVisionImage = {
  dataUrl: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  upscaled: boolean;
  sharpened: boolean;
};

function resolveTargetSize(
  sourceWidth: number,
  sourceHeight: number,
  options: VisionImageEnhanceOptions,
): { targetWidth: number; targetHeight: number; upscaled: boolean } {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const targetNarrowWidth = options.targetNarrowWidth ?? DEFAULT_TARGET_NARROW_WIDTH;
  const narrowWidthThreshold = options.narrowWidthThreshold ?? NARROW_WIDTH_THRESHOLD;
  const mildUpscaleFactor = options.mildUpscaleFactor ?? 1.75;
  const maxWorkingHeight = options.maxWorkingHeight ?? DEFAULT_MAX_WORKING_HEIGHT;

  let targetWidth = sourceWidth;
  let upscaled = false;

  if (sourceWidth > maxWidth) {
    targetWidth = maxWidth;
  } else if (sourceWidth > 0 && sourceWidth < narrowWidthThreshold) {
    targetWidth = Math.min(maxWidth, Math.max(targetNarrowWidth, sourceWidth * 2));
    upscaled = targetWidth > sourceWidth;
  } else if (sourceWidth > 0 && sourceWidth < maxWidth) {
    const boosted = Math.min(maxWidth, Math.round(sourceWidth * mildUpscaleFactor));
    if (boosted > sourceWidth) {
      targetWidth = boosted;
      upscaled = true;
    }
  }

  let targetHeight = Math.max(1, Math.round((sourceHeight * targetWidth) / Math.max(sourceWidth, 1)));

  if (targetHeight > maxWorkingHeight) {
    targetHeight = maxWorkingHeight;
    targetWidth = Math.max(1, Math.round((sourceWidth * maxWorkingHeight) / Math.max(sourceHeight, 1)));
    // Re-apply max width after height clamp.
    if (targetWidth > maxWidth) {
      targetWidth = maxWidth;
      targetHeight = Math.max(1, Math.round((sourceHeight * maxWidth) / Math.max(sourceWidth, 1)));
    }
    upscaled = targetWidth > sourceWidth || targetHeight > sourceHeight;
  }

  return { targetWidth, targetHeight, upscaled };
}

/**
 * Prepare a source image for vision slice/LLM: EXIF rotate, optional upscale for
 * narrow/compressed uploads, sharpen (+ optional normalize). Returns a JPEG data URL.
 *
 * Mirrors OCR `prepareOcrImageTiles` preprocessing so Vision is less dependent on
 * high-quality originals (e.g. WeChat/Feishu compressed long images).
 */
export async function enhanceVisionSourceImage(
  imageUrl: string,
  options: VisionImageEnhanceOptions = {},
): Promise<EnhancedVisionImage | undefined> {
  const buffer = await loadImageBuffer(imageUrl);
  if (!buffer) {
    return undefined;
  }

  const sharpen = options.sharpen ?? true;
  const normalizeRequested = options.normalize ?? true;

  try {
    const meta = await sharp(buffer, { failOn: 'none' }).rotate().metadata();
    const sourceWidth = meta.width ?? 0;
    const sourceHeight = meta.height ?? 0;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return undefined;
    }

    const { targetWidth, targetHeight, upscaled } = resolveTargetSize(
      sourceWidth,
      sourceHeight,
      options,
    );

    const needsResize = targetWidth !== sourceWidth || targetHeight !== sourceHeight;
    let pipeline = sharp(buffer, { failOn: 'none' }).rotate();
    if (needsResize) {
      pipeline = pipeline.resize({
        width: targetWidth,
        height: targetHeight,
        fit: 'fill',
        kernel: upscaled ? sharp.kernel.lanczos3 : undefined,
      });
    }

    const pixelCount = targetWidth * targetHeight;
    if (normalizeRequested && pixelCount <= NORMALIZE_PIXEL_BUDGET) {
      pipeline = pipeline.normalize();
    }
    if (sharpen) {
      pipeline = pipeline.sharpen({ sigma: 0.8 });
    }

    // Fast path: no geometric change and sharpen/normalize disabled.
    if (!needsResize && !sharpen && !normalizeRequested) {
      const jpeg = await sharp(buffer, { failOn: 'none' }).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      const outMeta = await sharp(jpeg).metadata();
      return {
        dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
        width: outMeta.width ?? sourceWidth,
        height: outMeta.height ?? sourceHeight,
        sourceWidth,
        sourceHeight,
        upscaled: false,
        sharpened: false,
      };
    }

    const jpeg = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    const outMeta = await sharp(jpeg).metadata();

    return {
      dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
      width: outMeta.width ?? targetWidth,
      height: outMeta.height ?? targetHeight,
      sourceWidth,
      sourceHeight,
      upscaled,
      sharpened: sharpen,
    };
  } catch {
    return undefined;
  }
}

/**
 * Enhance a single cropped slice before the vision LLM call.
 * Preferred for very tall PDPs: cheap per-band upscale instead of full-canvas blow-up.
 */
export async function enhanceVisionSliceImage(
  sliceDataUrl: string,
  options: VisionImageEnhanceOptions = {},
): Promise<string> {
  // Already-wide crops: sharpen only (skip normalize for speed in multi-slice PDPs).
  const enhanced = await enhanceVisionSourceImage(sliceDataUrl, {
    normalize: false,
    ...options,
    maxWorkingHeight: options.maxWorkingHeight ?? 4000,
    targetNarrowWidth: options.targetNarrowWidth ?? 1600,
  });
  return enhanced?.dataUrl ?? sliceDataUrl;
}

export async function enhanceVisionSourceImages(
  imageUrls: string[],
  options: VisionImageEnhanceOptions = {},
): Promise<Array<EnhancedVisionImage | undefined>> {
  return Promise.all(imageUrls.map((url) => enhanceVisionSourceImage(url, options)));
}
