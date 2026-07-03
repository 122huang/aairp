import { extractTextWithGoogleVision } from './google-vision.js';
import { isPaddleOcrEnabled, extractTextWithPaddleOcr } from './paddle-ocr.js';
import { prepareOcrImageTiles } from './long-image-prepare.js';

export type OcrPipelineResult = {
  text: string;
  provider: string;
  blockCount: number;
  tileCount: number;
  imageWidth: number;
  imageHeight: number;
  upscaled: boolean;
  segments?: Array<{ text: string; x0: number; y0: number }>;
};

export function resolveOcrProvider(): 'paddle' | 'google' | 'browser' {
  const preferred = process.env.OCR_PROVIDER?.trim().toLowerCase();
  if (preferred === 'paddle' && isPaddleOcrEnabled()) return 'paddle';
  if (preferred === 'google' && process.env.GOOGLE_VISION_API_KEY?.trim()) return 'google';
  if (preferred === 'browser') return 'browser';
  if (isPaddleOcrEnabled()) return 'paddle';
  if (process.env.GOOGLE_VISION_API_KEY?.trim()) return 'google';
  return 'browser';
}

export async function extractTextFromUpload(
  base64Image: string,
  _mimeType: string,
): Promise<OcrPipelineResult> {
  const rawBase64 = base64Image.includes(',') ? base64Image.split(',')[1]! : base64Image;
  const imageBuffer = Buffer.from(rawBase64, 'base64');

  if (imageBuffer.length === 0) {
    throw new Error('图片数据为空，请重新选择文件');
  }

  const provider = resolveOcrProvider();

  if (provider === 'paddle') {
    const result = await extractTextWithPaddleOcr(imageBuffer);
    return {
      text: result.text,
      provider: result.provider,
      blockCount: result.blockCount,
      tileCount: result.tileCount,
      imageWidth: result.imageWidth,
      imageHeight: result.imageHeight,
      upscaled: result.upscaled,
      segments: result.segments,
    };
  }

  if (provider === 'google') {
    const prepared = await prepareOcrImageTiles(imageBuffer, {
      allowUpscale: true,
      maxWidth: 2400,
      sharpen: true,
    });
    const parts: string[] = [];
    let blockCount = 0;

    for (const tile of prepared.tiles) {
      const result = await extractTextWithGoogleVision(tile.base64, tile.mimeType);
      if (result.text.trim()) {
        parts.push(result.text.trim());
      }
      blockCount += result.blockCount;
    }

    const text = parts.join('\n\n').trim();
    if (!text) {
      throw new Error(
        '未识别到文字。长图可尝试更清晰的原图，或在文案框手动粘贴/补充关键宣传语。',
      );
    }

    return {
      text,
      provider: 'google_vision',
      blockCount,
      tileCount: prepared.tiles.length,
      imageWidth: prepared.width,
      imageHeight: prepared.height,
      upscaled: prepared.upscaled,
    };
  }

  throw new Error(
    '未配置服务端 OCR。请启用 PaddleOCR（scripts/setup-paddle-ocr.ps1）或配置 GOOGLE_VISION_API_KEY。',
  );
}
