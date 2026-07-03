import { extractTextFromUpload, resolveOcrProvider } from './ocr-pipeline.js';
import { prepareVisionLlmImage } from './long-image-prepare.js';
import { understandAdCopyFromOcr, type OcrUnderstandResult } from './ocr-understand.js';

export type SmartExtractResult = {
  ocr_draft: string;
  ocr_provider: string;
  ocr_tile_count: number;
  ocr_upscaled: boolean;
  image_width: number;
  image_height: number;
  confirmed_text: string;
  structured: OcrUnderstandResult['structured'];
  uncertain: OcrUnderstandResult['uncertain'];
  understand_provider: string;
  notes: string[];
};

async function extractServerOcrDraft(imageBuffer: Buffer): Promise<{
  text: string;
  provider: string;
  tileCount: number;
  upscaled: boolean;
  width: number;
  height: number;
}> {
  const result = await extractTextFromUpload(imageBuffer.toString('base64'), 'image/jpeg');
  return {
    text: result.text,
    provider: result.provider,
    tileCount: result.tileCount,
    upscaled: result.upscaled,
    width: result.imageWidth,
    height: result.imageHeight,
  };
}

export async function smartExtractAdCopy(input: {
  imageBase64?: string;
  ocrDraft?: string;
  mimeType?: string;
  categoryId?: string;
}): Promise<SmartExtractResult> {
  const rawBase64 = input.imageBase64?.includes(',')
    ? input.imageBase64.split(',')[1]!
    : input.imageBase64;
  const imageBuffer = rawBase64 ? Buffer.from(rawBase64, 'base64') : null;

  let ocrDraft = input.ocrDraft?.trim() ?? '';
  let ocrProvider = 'client_browser';
  let tileCount = 0;
  let upscaled = false;
  let width = 0;
  let height = 0;

  const serverOcr = resolveOcrProvider();
  if (serverOcr !== 'browser' && imageBuffer && imageBuffer.length > 0) {
    const extracted = await extractServerOcrDraft(imageBuffer);
    ocrDraft = extracted.text;
    ocrProvider = extracted.provider;
    tileCount = extracted.tileCount;
    upscaled = extracted.upscaled;
    width = extracted.width;
    height = extracted.height;
  } else if (!ocrDraft) {
    throw new Error(
      '缺少 OCR 草稿。请先在浏览器完成本地 OCR，或启用 PaddleOCR / 配置 GOOGLE_VISION_API_KEY。',
    );
  }

  let visionImageBase64: string | undefined;
  let visionMimeType = input.mimeType ?? 'image/jpeg';
  if (imageBuffer && imageBuffer.length > 0) {
    const visionImage = await prepareVisionLlmImage(imageBuffer);
    visionImageBase64 = visionImage.base64;
    visionMimeType = visionImage.mimeType;
    if (!width) width = visionImage.width;
    if (!height) height = visionImage.height;
  }

  const understood = await understandAdCopyFromOcr({
    ocrDraft,
    imageBase64: visionImageBase64,
    mimeType: visionMimeType,
    categoryId: input.categoryId,
  });

  return {
    ocr_draft: ocrDraft,
    ocr_provider: ocrProvider,
    ocr_tile_count: tileCount,
    ocr_upscaled: upscaled,
    image_width: width,
    image_height: height,
    confirmed_text: understood.confirmed_text,
    structured: understood.structured,
    uncertain: understood.uncertain,
    understand_provider: understood.understand_provider,
    notes: understood.notes,
  };
}
