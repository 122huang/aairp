import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ImageSlice } from '@aairp/shared-kernel';
import sharp from 'sharp';

const DATA_URL_PATTERN = /^data:image\/([a-z0-9+.-]+);base64,(.+)$/i;
const FIXTURE_URL_PATTERN = /^fixture:\/\/image-compliance\/(.+)$/i;

const imageComplianceFixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../benchmark/fixtures/image-compliance',
);

function parseDataUrl(imageUrl: string): { mime: string; buffer: Buffer } | undefined {
  const match = imageUrl.match(DATA_URL_PATTERN);
  if (!match?.[2]) {
    return undefined;
  }
  return {
    mime: match[1] ?? 'jpeg',
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function fileUrlToPath(imageUrl: string): string | undefined {
  if (!imageUrl.startsWith('file:')) {
    return undefined;
  }
  try {
    return fileURLToPath(imageUrl);
  } catch {
    return undefined;
  }
}

function resolveFixturePath(imageUrl: string): string | undefined {
  const match = imageUrl.match(FIXTURE_URL_PATTERN);
  if (!match?.[1]) {
    return undefined;
  }
  const relative = match[1].replace(/\\/g, '/');
  if (relative.includes('..') || relative.startsWith('/')) {
    return undefined;
  }
  return join(imageComplianceFixtureRoot, relative);
}

/**
 * Load image bytes from data URL, fixture://, file:// URL, local filesystem path, or http(s).
 * Remote fetch failures return undefined so callers can fall back gracefully.
 */
export async function loadImageBuffer(imageUrl: string): Promise<Buffer | undefined> {
  const parsed = parseDataUrl(imageUrl);
  if (parsed) {
    return parsed.buffer;
  }

  const fixturePath = resolveFixturePath(imageUrl);
  if (fixturePath) {
    try {
      return await readFile(fixturePath);
    } catch {
      return undefined;
    }
  }

  const filePath = fileUrlToPath(imageUrl);
  if (filePath) {
    try {
      return await readFile(filePath);
    } catch {
      return undefined;
    }
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    try {
      const timeoutMs = Number(process.env.AAIRP_IMAGE_FETCH_TIMEOUT_MS ?? 2500);
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(
          Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2500,
        ),
      });
      if (!response.ok) {
        return undefined;
      }
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return undefined;
    }
  }

  if (/^[A-Za-z]:[\\/]/.test(imageUrl) || imageUrl.startsWith('/') || imageUrl.startsWith('.')) {
    try {
      return await readFile(imageUrl);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/** Normalize any supported image reference into a JPEG data URL for vision crop/LLM. */
export async function toImageDataUrl(imageUrl: string): Promise<string | undefined> {
  if (imageUrl.startsWith('data:image/')) {
    return imageUrl;
  }

  const buffer = await loadImageBuffer(imageUrl);
  if (!buffer) {
    return undefined;
  }

  const jpeg = await sharp(buffer).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

export async function probeImageDimensions(
  imageUrl: string,
): Promise<{ width: number; height: number } | undefined> {
  const buffer = await loadImageBuffer(imageUrl);
  if (!buffer) {
    return undefined;
  }

  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) {
    return undefined;
  }

  return { width: meta.width, height: meta.height };
}

export async function cropImageDataUrlForSlice(
  imageUrl: string,
  slice: Pick<ImageSlice, 'yStart' | 'yEnd'>,
): Promise<string> {
  if (slice.yStart <= 0 && slice.yEnd >= 1) {
    const normalized = await toImageDataUrl(imageUrl);
    return normalized ?? imageUrl;
  }

  const buffer = await loadImageBuffer(imageUrl);
  if (!buffer) {
    return imageUrl;
  }

  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) {
    return imageUrl;
  }

  const top = Math.max(0, Math.min(height - 1, Math.round(slice.yStart * height)));
  const bottom = Math.max(top + 1, Math.min(height, Math.round(slice.yEnd * height)));
  const cropHeight = bottom - top;

  const cropped = await sharp(buffer)
    .extract({ left: 0, top, width, height: cropHeight })
    .jpeg({ quality: 85 })
    .toBuffer();

  return `data:image/jpeg;base64,${cropped.toString('base64')}`;
}

/** Crop a slice then resize to maxWidth JPEG (quality 70) for report thumbnails. */
export async function createSliceThumbnailDataUrl(
  imageUrl: string,
  slice: Pick<ImageSlice, 'yStart' | 'yEnd'>,
  maxWidth = 240,
): Promise<string | undefined> {
  const croppedDataUrl = await cropImageDataUrlForSlice(imageUrl, slice);
  const buffer = await loadImageBuffer(croppedDataUrl);
  if (!buffer) {
    return undefined;
  }

  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  if (width <= 0) {
    return undefined;
  }

  const pipeline =
    width > maxWidth
      ? sharp(buffer).resize({ width: maxWidth, fit: 'inside' })
      : sharp(buffer);

  const jpeg = await pipeline.jpeg({ quality: 70 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

export function toFileImageUrl(absolutePath: string): string {
  return pathToFileURL(absolutePath).href;
}

export { imageComplianceFixtureRoot as defaultFixtureRoot };
