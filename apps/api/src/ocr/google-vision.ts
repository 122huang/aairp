type VisionResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    textAnnotations?: Array<{ description?: string }>;
    error?: { message?: string };
  }>;
};

export type OcrExtractResult = {
  text: string;
  provider: string;
  blockCount: number;
};

export async function extractTextWithGoogleVision(
  base64Image: string,
  _mimeType: string,
): Promise<OcrExtractResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      '未配置 GOOGLE_VISION_API_KEY。请在项目 .env 中填写 Google Cloud Vision API Key 后重启 API。',
    );
  }

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          imageContext: { languageHints: ['en', 'zh', 'ms', 'th'] },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Vision API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as VisionResponse;
  const first = data.responses?.[0];
  if (first?.error?.message) {
    throw new Error(first.error.message);
  }

  const text =
    first?.fullTextAnnotation?.text?.trim() ||
    first?.textAnnotations?.[0]?.description?.trim() ||
    '';

  if (!text) {
    throw new Error('No text detected in image. Try a clearer long-banner image or paste text manually.');
  }

  const blockCount = first?.textAnnotations?.length ?? (text ? 1 : 0);

  return {
    text,
    provider: 'google_vision',
    blockCount,
  };
}
