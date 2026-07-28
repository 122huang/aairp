import type { ImageContentBlockHint, ImageSliceType } from '@aairp/shared-kernel';
import sharp from 'sharp';
import { loadImageBuffer } from './image-slice-crop.js';

const LABEL_CYCLE: Exclude<ImageSliceType, 'unknown'>[] = [
  'hero',
  'claims',
  'lifestyle',
  'claims',
  'certification',
  'comparison',
  'footer',
];

export type SectionSegmenterOptions = {
  /** Working width for row-color analysis. Default 48. */
  analysisWidth?: number;
  /** Minimum segment height as fraction of image height. Default 0.04. */
  minSegmentRatio?: number;
  /** Color-delta threshold (0–765 RGB L1). Default 28. */
  boundaryThreshold?: number;
  /** Soften row deltas before peak picking. Default 3. */
  smoothWindow?: number;
  maxSegments?: number;
};

function smoothSeries(values: number[], window: number): number[] {
  if (window <= 1) {
    return values;
  }
  const half = Math.floor(window / 2);
  return values.map((_, index) => {
    let sum = 0;
    let count = 0;
    for (let i = index - half; i <= index + half; i += 1) {
      if (i >= 0 && i < values.length) {
        sum += values[i]!;
        count += 1;
      }
    }
    return sum / count;
  });
}

function labelForIndex(index: number, total: number): Exclude<ImageSliceType, 'unknown'> {
  if (total <= 1) {
    return 'hero';
  }
  if (index === 0) {
    return 'hero';
  }
  if (index === total - 1) {
    return 'footer';
  }
  return LABEL_CYCLE[Math.min(index, LABEL_CYCLE.length - 1)] ?? 'claims';
}

/**
 * Heuristic long-image section detector: row-average color jumps → content blocks.
 * ADR-005 non-goal is ML segmentation; color/whitespace bands are enough for PDP strips.
 */
export async function detectContentBlocksFromImage(
  imageUrl: string,
  options: SectionSegmenterOptions = {},
): Promise<ImageContentBlockHint[] | undefined> {
  try {
    const buffer = await loadImageBuffer(imageUrl);
    if (!buffer) {
      return undefined;
    }

    const analysisWidth = options.analysisWidth ?? 48;
    const minSegmentRatio = options.minSegmentRatio ?? 0.04;
    const boundaryThreshold = options.boundaryThreshold ?? 28;
    const smoothWindow = options.smoothWindow ?? 3;
    const maxSegments = options.maxSegments ?? 8;

    const { data, info } = await sharp(buffer)
      .resize({ width: analysisWidth, fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    if (width <= 0 || height < 8) {
      return undefined;
    }

    const rowMeans: Array<{ r: number; g: number; b: number }> = [];
    for (let y = 0; y < height; y += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      const rowOffset = y * width * 3;
      for (let x = 0; x < width; x += 1) {
        const i = rowOffset + x * 3;
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
      }
      rowMeans.push({ r: r / width, g: g / width, b: b / width });
    }

    const deltas = [0];
    for (let y = 1; y < rowMeans.length; y += 1) {
      const prev = rowMeans[y - 1]!;
      const curr = rowMeans[y]!;
      deltas.push(
        Math.abs(curr.r - prev.r) + Math.abs(curr.g - prev.g) + Math.abs(curr.b - prev.b),
      );
    }
    const smoothed = smoothSeries(deltas, smoothWindow);

    const boundaries = [0];
    for (let y = 2; y < smoothed.length - 2; y += 1) {
      const value = smoothed[y]!;
      if (
        value >= boundaryThreshold &&
        value >= (smoothed[y - 1] ?? 0) &&
        value >= (smoothed[y + 1] ?? 0)
      ) {
        const last = boundaries[boundaries.length - 1]!;
        if (y - last >= Math.max(2, Math.floor(height * minSegmentRatio))) {
          boundaries.push(y);
        }
      }
    }
    boundaries.push(height);

    while (boundaries.length - 1 > maxSegments) {
      let weakestIndex = 1;
      let weakestScore = Number.POSITIVE_INFINITY;
      for (let i = 1; i < boundaries.length - 1; i += 1) {
        const score = smoothed[boundaries[i]!] ?? 0;
        if (score < weakestScore) {
          weakestScore = score;
          weakestIndex = i;
        }
      }
      boundaries.splice(weakestIndex, 1);
    }

    const minPx = Math.max(2, Math.floor(height * minSegmentRatio));
    const ranges: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < boundaries.length - 1; i += 1) {
      const start = boundaries[i]!;
      const end = boundaries[i + 1]!;
      if (end - start < minPx && ranges.length > 0) {
        ranges[ranges.length - 1]!.end = end;
      } else {
        ranges.push({ start, end });
      }
    }

    if (ranges.length < 2) {
      return undefined;
    }

    return ranges.map((range, index) => ({
      blockType: labelForIndex(index, ranges.length),
      yStart: range.start / height,
      yEnd: range.end / height,
    }));
  } catch {
    return undefined;
  }
}
