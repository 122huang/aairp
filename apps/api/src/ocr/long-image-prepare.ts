import sharp from 'sharp';

const DEFAULT_MAX_TILE_HEIGHT = 3200;
const DEFAULT_MAX_WIDTH = 2400;
const DEFAULT_MAX_UPSCALE_WIDTH = 2400;
const DEFAULT_TILE_OVERLAP = 160;
const MAX_TILES = 24;

export type PreparedOcrTile = {
  base64: string;
  mimeType: 'image/jpeg';
  index: number;
  top: number;
  height: number;
};

export type PreparedOcrImage = {
  width: number;
  height: number;
  tiles: PreparedOcrTile[];
  upscaled: boolean;
};

export type PrepareOcrOptions = {
  /** Target width for OCR (may upscale small images when allowUpscale is true). */
  maxWidth?: number;
  maxTileHeight?: number;
  tileOverlap?: number;
  allowUpscale?: boolean;
  maxUpscaleWidth?: number;
  sharpen?: boolean;
};

function resolveTargetWidth(
  sourceWidth: number,
  options: PrepareOcrOptions,
): { targetWidth: number; upscaled: boolean } {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxUpscaleWidth = options.maxUpscaleWidth ?? DEFAULT_MAX_UPSCALE_WIDTH;
  const allowUpscale = options.allowUpscale ?? true;

  if (sourceWidth > maxWidth) {
    return { targetWidth: maxWidth, upscaled: false };
  }

  if (allowUpscale && sourceWidth < maxWidth) {
    const boosted = Math.min(maxUpscaleWidth, Math.round(sourceWidth * 1.75));
    if (boosted > sourceWidth) {
      return { targetWidth: boosted, upscaled: true };
    }
  }

  return { targetWidth: sourceWidth, upscaled: false };
}

async function buildResizedBuffer(
  normalized: sharp.Sharp,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  upscaled: boolean,
  sharpen: boolean,
): Promise<Buffer> {
  let pipeline = normalized.resize({
    width: targetWidth,
    height: Math.max(1, Math.round((sourceHeight * targetWidth) / sourceWidth)),
    fit: 'inside',
    withoutEnlargement: !upscaled,
  });

  if (sharpen) {
    pipeline = pipeline.sharpen({ sigma: 0.8 });
  }

  return pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

export async function prepareOcrImageTiles(
  imageBuffer: Buffer,
  options: PrepareOcrOptions = {},
): Promise<PreparedOcrImage> {
  const maxTileHeight = options.maxTileHeight ?? DEFAULT_MAX_TILE_HEIGHT;
  const tileOverlap = options.tileOverlap ?? DEFAULT_TILE_OVERLAP;
  const sharpen = options.sharpen ?? true;

  const normalized = sharp(imageBuffer, { failOn: 'none' }).rotate();
  const meta = await normalized.metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('无法读取图片尺寸，请确认文件为 JPG/PNG 等常见格式');
  }

  const { targetWidth, upscaled } = resolveTargetWidth(sourceWidth, options);
  const resized = await buildResizedBuffer(
    normalized,
    sourceWidth,
    sourceHeight,
    targetWidth,
    upscaled,
    sharpen,
  );

  const resizedMeta = await sharp(resized).metadata();
  const width = resizedMeta.width ?? targetWidth;
  const height = resizedMeta.height ?? 1;

  if (height <= maxTileHeight) {
    return {
      width,
      height,
      upscaled,
      tiles: [
        {
          base64: resized.toString('base64'),
          mimeType: 'image/jpeg',
          index: 0,
          top: 0,
          height,
        },
      ],
    };
  }

  const stride = Math.max(1, maxTileHeight - tileOverlap);
  const tileCount = Math.ceil((height - tileOverlap) / stride);
  if (tileCount > MAX_TILES) {
    throw new Error(
      `图片过长（约 ${height}px），超过单次识别上限。请裁剪后分段上传，或手动粘贴文案。`,
    );
  }

  const tiles: PreparedOcrTile[] = [];
  for (let index = 0, top = 0; top < height; index += 1) {
    const tileHeight = Math.min(maxTileHeight, height - top);
    const tileBuffer = await sharp(resized)
      .extract({ left: 0, top, width, height: tileHeight })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    tiles.push({
      base64: tileBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      index,
      top,
      height: tileHeight,
    });

    if (top + tileHeight >= height) {
      break;
    }
    top += stride;
  }

  return { width, height, upscaled, tiles };
}

/** Smaller image for vision LLM (full height, moderate width). */
export async function prepareVisionLlmImage(
  imageBuffer: Buffer,
  maxWidth = 1400,
): Promise<{ base64: string; mimeType: 'image/jpeg'; width: number; height: number }> {
  const normalized = sharp(imageBuffer, { failOn: 'none' }).rotate();
  const meta = await normalized.metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;
  const targetWidth = sourceWidth > maxWidth ? maxWidth : sourceWidth;

  const buffer = await normalized
    .resize({
      width: targetWidth,
      height: Math.max(1, Math.round((sourceHeight * targetWidth) / Math.max(sourceWidth, 1))),
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const outMeta = await sharp(buffer).metadata();
  return {
    base64: buffer.toString('base64'),
    mimeType: 'image/jpeg',
    width: outMeta.width ?? targetWidth,
    height: outMeta.height ?? 1,
  };
}
