import type { FastifyInstance } from 'fastify';
import { extractTextFromUpload, resolveOcrProvider } from '../ocr/ocr-pipeline.js';
import { isPaddleOcrEnabled } from '../ocr/paddle-ocr.js';
import { resolveTextLlmProvider, resolveVisionLlmProvider } from '../ocr/llm-providers.js';
import { smartExtractAdCopy } from '../ocr/smart-extract.js';

type OcrExtractBody = {
  image_base64?: string;
  mime_type?: string;
};

type SmartExtractBody = {
  image_base64?: string;
  mime_type?: string;
  ocr_draft?: string;
  category_id?: string;
};

const OCR_BODY_LIMIT = 20 * 1024 * 1024;

export async function registerOcrController(app: FastifyInstance): Promise<void> {
  app.get('/demo/ocr/status', async (_request, reply) => {
    const hasGoogle = Boolean(process.env.GOOGLE_VISION_API_KEY?.trim());
    const hasPaddle = isPaddleOcrEnabled();
    const ocrProvider = resolveOcrProvider();
    const visionLlm = resolveVisionLlmProvider();
    const textLlm = resolveTextLlmProvider();

    const label =
      ocrProvider === 'paddle'
        ? '本地 PaddleOCR（中文长图）+ LLM 读懂'
        : ocrProvider === 'google'
          ? 'Google Cloud Vision OCR + LLM 读懂'
          : '浏览器 OCR + 服务端 LLM 读懂（若已配置 Key）';

    return reply.send({
      provider: ocrProvider,
      label,
      capabilities: {
        paddle_ocr: hasPaddle,
        google_ocr: hasGoogle,
        browser_ocr: true,
        vision_llm: Boolean(visionLlm),
        text_llm: Boolean(textLlm),
        vision_llm_provider: visionLlm,
        text_llm_provider: textLlm,
        smart_extract: Boolean(textLlm || visionLlm),
      },
    });
  });

  app.post(
    '/demo/ocr/smart-extract',
    { bodyLimit: OCR_BODY_LIMIT },
    async (request, reply) => {
      const body = request.body as SmartExtractBody;
      const imageRaw = body?.image_base64?.trim();
      const ocrDraft = body?.ocr_draft?.trim();
      const categoryId = body?.category_id?.trim();

      if (!imageRaw && !ocrDraft) {
        return reply.status(400).send({
          type: 'https://aairp.example.com/problems/invalid-request',
          title: 'Bad Request',
          status: 400,
          detail: 'image_base64 or ocr_draft is required',
        });
      }

      try {
        const result = await smartExtractAdCopy({
          imageBase64: imageRaw,
          ocrDraft,
          mimeType: body.mime_type?.trim() || 'image/png',
          categoryId,
        });
        return reply.send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'smart extract failed';
        request.log.error({ err: error }, 'ocr smart extract failed');
        return reply.status(503).send({
          type: 'https://aairp.example.com/problems/service-unavailable',
          title: 'Smart Extract Unavailable',
          status: 503,
          detail: message,
        });
      }
    },
  );

  app.post(
    '/demo/ocr/extract',
    { bodyLimit: OCR_BODY_LIMIT },
    async (request, reply) => {
      const body = request.body as OcrExtractBody;
      const raw = body?.image_base64?.trim();
      if (!raw) {
        return reply.status(400).send({
          type: 'https://aairp.example.com/problems/invalid-request',
          title: 'Bad Request',
          status: 400,
          detail: 'image_base64 is required',
        });
      }

      const mimeType = body.mime_type?.trim() || 'image/png';
      const base64 = raw.includes(',') ? raw.split(',')[1]! : raw;

      try {
        const result = await extractTextFromUpload(base64, mimeType);
        return reply.send({
          ocr_text: result.text,
          provider: result.provider,
          block_count: result.blockCount,
          tile_count: result.tileCount,
          image_width: result.imageWidth,
          image_height: result.imageHeight,
          upscaled: result.upscaled,
          segments: result.segments ?? [],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'OCR failed';
        request.log.error({ err: error }, 'ocr extract failed');
        return reply.status(503).send({
          type: 'https://aairp.example.com/problems/service-unavailable',
          title: 'OCR Unavailable',
          status: 503,
          detail: message,
        });
      }
    },
  );
}
