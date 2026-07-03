import { cleanOcrResult } from './ocr-segment-filter.js';

const MAX_UPLOAD_WIDTH = 2400;
const MAX_UPSCALE_WIDTH = 2400;
const MAX_TILE_HEIGHT = 2800;
const TILE_OVERLAP = 160;
const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm';

let workerPromise = null;

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      onProgress?.('首次使用：正在加载本地 OCR 引擎（需联网）…');
      let createWorker;
      try {
        ({ createWorker } = await import(TESSERACT_CDN));
      } catch {
        throw new Error(
          '无法加载本地 OCR 组件（可能被公司网络拦截）。请改用手动粘贴文案，或稍后再试。',
        );
      }
      const worker = await createWorker('eng+chi_sim', 1, {
        logger: (message) => {
          if (message.status === 'loading language traineddata') {
            onProgress?.('正在下载英文/中文语言包…');
          }
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
      });
      return worker;
    })();
  }
  return workerPromise;
}

async function loadImageElement(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('无法读取图片文件'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function resolveOcrWidth(naturalWidth) {
  if (naturalWidth > MAX_UPLOAD_WIDTH) {
    return { width: MAX_UPLOAD_WIDTH, upscaled: false };
  }
  const boosted = Math.min(MAX_UPSCALE_WIDTH, Math.round(naturalWidth * 1.75));
  if (boosted > naturalWidth) {
    return { width: boosted, upscaled: true };
  }
  return { width: naturalWidth, upscaled: false };
}

function boostContrastCanvas(ctx, width, height, factor = 1.35) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = data[i + channel];
      data[i + channel] = Math.min(255, Math.max(0, Math.round((value - 128) * factor + 128)));
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function sharpenCanvas(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const copy = new Uint8ClampedArray(data);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + channel;
            sum += copy[idx] * kernel[ki];
            ki += 1;
          }
        }
        data[(y * width + x) * 4 + channel] = Math.min(255, Math.max(0, sum));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export async function splitImageFileToCanvasTiles(file) {
  const img = await loadImageElement(file);
  const { width, upscaled } = resolveOcrWidth(img.naturalWidth);
  const scale = width / img.naturalWidth;
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const full = document.createElement('canvas');
  full.width = width;
  full.height = height;
  const fullCtx = full.getContext('2d');
  fullCtx.imageSmoothingEnabled = true;
  fullCtx.imageSmoothingQuality = 'high';
  fullCtx.drawImage(img, 0, 0, width, height);
  boostContrastCanvas(fullCtx, width, height);
  sharpenCanvas(fullCtx, width, height);

  const tiles = [];
  const stride = Math.max(1, MAX_TILE_HEIGHT - TILE_OVERLAP);
  for (let top = 0; top < height; top += stride) {
    const tileHeight = Math.min(MAX_TILE_HEIGHT, height - top);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = tileHeight;
    canvas.getContext('2d').drawImage(full, 0, top, width, tileHeight, 0, 0, width, tileHeight);
    tiles.push({ canvas, width, height: tileHeight, top });
    if (top + tileHeight >= height) break;
  }

  return { tiles, width, height, upscaled };
}

function collectLineSegments(data, tileTop) {
  const segments = [];
  for (const line of data.lines ?? []) {
    const text = line.text?.trim();
    if (!text || !line.bbox) continue;
    segments.push({
      text,
      confidence: typeof line.confidence === 'number' ? line.confidence : undefined,
      x0: line.bbox.x0,
      y0: tileTop + line.bbox.y0,
      x1: line.bbox.x1,
      y1: tileTop + line.bbox.y1,
    });
  }
  return segments;
}

export async function extractTextFromImageFile(file, { onProgress } = {}) {
  const { tiles, width, height, upscaled } = await splitImageFileToCanvasTiles(file);
  const worker = await getWorker(onProgress);
  const parts = [];
  const segments = [];

  for (let index = 0; index < tiles.length; index += 1) {
    onProgress?.(
      `OCR 抓字 ${index + 1}/${tiles.length} 段${upscaled ? '（已放大便于小字）' : ''}…`,
    );
    const { data } = await worker.recognize(tiles[index].canvas);
    segments.push(...collectLineSegments(data, tiles[index].top));
    if (data.text?.trim()) {
      parts.push(data.text.trim());
    }
  }

  const ocrText = parts.join('\n\n').trim();
  const raw = {
    ocr_text: ocrText,
    ocr_draft: ocrText,
    segments,
    provider: 'browser_tesseract_upscaled',
    tile_count: tiles.length,
    image_width: width,
    image_height: height,
    upscaled,
  };
  const cleaned = cleanOcrResult(raw);
  if (!cleaned.ocr_text) {
    throw new Error('未识别到文字，请手动粘贴标题与卖点文案');
  }
  return cleaned;
}
