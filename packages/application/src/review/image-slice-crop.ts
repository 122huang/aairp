import type { ImageSlice } from '@aairp/shared-kernel';
import sharp from 'sharp';

const DATA_URL_PATTERN = /^data:image\/([a-z0-9+.-]+);base64,(.+)$/i;

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

export async function probeImageDimensions(
  imageUrl: string,
): Promise<{ width: number; height: number } | undefined> {
  const parsed = parseDataUrl(imageUrl);
  if (!parsed) {
    return undefined;
  }

  const meta = await sharp(parsed.buffer).metadata();
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
    return imageUrl;
  }

  const parsed = parseDataUrl(imageUrl);
  if (!parsed) {
    return imageUrl;
  }

  const meta = await sharp(parsed.buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) {
    return imageUrl;
  }

  const top = Math.max(0, Math.min(height - 1, Math.round(slice.yStart * height)));
  const bottom = Math.max(top + 1, Math.min(height, Math.round(slice.yEnd * height)));
  const cropHeight = bottom - top;

  const cropped = await sharp(parsed.buffer)
    .extract({ left: 0, top, width, height: cropHeight })
    .jpeg({ quality: 85 })
    .toBuffer();

  return `data:image/jpeg;base64,${cropped.toString('base64')}`;
}
