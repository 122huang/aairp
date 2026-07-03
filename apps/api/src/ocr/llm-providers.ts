type JsonMessage = Record<string, unknown>;

export type VisionLlmRequest = {
  prompt: string;
  imageBase64: string;
  mimeType: string;
  maxTokens?: number;
};

export type TextLlmRequest = {
  prompt: string;
  maxTokens?: number;
};

function resolveVisionModel(provider: 'anthropic' | 'openai'): string {
  const specific = process.env.OCR_VISION_LLM_MODEL?.trim();
  if (specific) return specific;
  const legacy = process.env.OCR_LLM_MODEL?.trim();
  if (legacy) {
    if (provider === 'anthropic' && legacy.startsWith('claude')) return legacy;
    if (provider === 'openai' && (legacy.startsWith('gpt') || legacy.startsWith('o'))) return legacy;
  }
  return provider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini';
}

function resolveTextModel(provider: 'deepseek' | 'anthropic' | 'openai'): string {
  const specific = process.env.OCR_TEXT_LLM_MODEL?.trim();
  if (specific) return specific;
  const legacy = process.env.OCR_LLM_MODEL?.trim();
  if (legacy) {
    if (provider === 'deepseek' && legacy.startsWith('deepseek')) return legacy;
    if (provider === 'anthropic' && legacy.startsWith('claude')) return legacy;
    if (provider === 'openai' && (legacy.startsWith('gpt') || legacy.startsWith('o'))) return legacy;
  }
  if (provider === 'deepseek') return 'deepseek-v4-flash';
  if (provider === 'anthropic') return 'claude-3-5-haiku-20241022';
  return 'gpt-4o-mini';
}

async function readAnthropicText(data: JsonMessage): Promise<string> {
  const content = data.content;
  if (!Array.isArray(content)) {
    throw new Error('Anthropic response missing content');
  }
  const textBlock = content.find(
    (block): block is { type: string; text: string } =>
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: string }).type === 'text' &&
      typeof (block as { text?: string }).text === 'string',
  );
  if (!textBlock?.text) {
    throw new Error('Anthropic response missing text block');
  }
  return textBlock.text;
}

async function readOpenAiText(data: JsonMessage): Promise<string> {
  const choice = (data.choices as JsonMessage[] | undefined)?.[0];
  const message = choice?.message as JsonMessage | undefined;
  const content = message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI response missing message content');
  }
  return content;
}

export async function completeAnthropicVision(
  request: VisionLlmRequest,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model = resolveVisionModel('anthropic');
  const baseUrl = (process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com').replace(
    /\/$/,
    '',
  );
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens ?? 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: request.mimeType,
                data: request.imageBase64,
              },
            },
            { type: 'text', text: request.prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }

  return readAnthropicText((await response.json()) as JsonMessage);
}

export async function completeOpenAiVision(request: VisionLlmRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const model = resolveVisionModel('openai');
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com').replace(
    /\/$/,
    '',
  );
  return completeOpenAiCompatibleVision(request, { apiKey, baseUrl, model, label: 'OpenAI' });
}

async function completeOpenAiCompatibleVision(
  request: VisionLlmRequest,
  options: { apiKey: string; baseUrl: string; model: string; label: string },
): Promise<string> {
  const response = await fetch(`${options.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: request.maxTokens ?? 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${request.mimeType};base64,${request.imageBase64}`,
              },
            },
            { type: 'text', text: request.prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${options.label} API ${response.status}: ${errText.slice(0, 300)}`);
  }

  return readOpenAiText((await response.json()) as JsonMessage);
}

export async function completeDeepSeekVision(request: VisionLlmRequest): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const model = resolveTextModel('deepseek');
  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(
    /\/$/,
    '',
  );
  return completeOpenAiCompatibleVision(request, { apiKey, baseUrl, model, label: 'DeepSeek' });
}

export async function completeAnthropicText(request: TextLlmRequest): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model = resolveTextModel('anthropic');
  const baseUrl = (process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com').replace(
    /\/$/,
    '',
  );
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens ?? 4096,
      messages: [{ role: 'user', content: request.prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }

  return readAnthropicText((await response.json()) as JsonMessage);
}

export async function completeOpenAiText(request: TextLlmRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const model = resolveTextModel('openai');
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com').replace(
    /\/$/,
    '',
  );
  return completeOpenAiCompatibleText(request, { apiKey, baseUrl, model, label: 'OpenAI' });
}

async function completeOpenAiCompatibleText(
  request: TextLlmRequest,
  options: { apiKey: string; baseUrl: string; model: string; label: string },
): Promise<string> {
  const response = await fetch(`${options.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: request.maxTokens ?? 4096,
      messages: [{ role: 'user', content: request.prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${options.label} API ${response.status}: ${errText.slice(0, 300)}`);
  }

  return readOpenAiText((await response.json()) as JsonMessage);
}

export async function completeDeepSeekText(request: TextLlmRequest): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const model = resolveTextModel('deepseek');
  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(
    /\/$/,
    '',
  );
  return completeOpenAiCompatibleText(request, { apiKey, baseUrl, model, label: 'DeepSeek' });
}

export type VisionLlmProviderName = 'deepseek' | 'anthropic' | 'openai';

/** Hosted DeepSeek chat API is text-only (no image_url). Vision uses Anthropic/OpenAI. */
const VISION_CAPABLE: VisionLlmProviderName[] = ['anthropic', 'openai'];
const TEXT_PROVIDER_ORDER: VisionLlmProviderName[] = ['deepseek', 'anthropic', 'openai'];

function providerHasKey(name: VisionLlmProviderName): boolean {
  switch (name) {
    case 'deepseek':
      return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    default:
      return false;
  }
}

export function resolveVisionLlmProvider(): VisionLlmProviderName | null {
  const preferred = process.env.OCR_VISION_PROVIDER?.trim().toLowerCase();
  if (preferred === 'deepseek') {
    return null;
  }

  if (preferred === 'anthropic' || preferred === 'openai') {
    return providerHasKey(preferred) ? preferred : null;
  }

  for (const name of VISION_CAPABLE) {
    if (providerHasKey(name)) {
      return name;
    }
  }
  return null;
}

export function resolveTextLlmProvider(): VisionLlmProviderName | null {
  const preferred = process.env.OCR_TEXT_PROVIDER?.trim().toLowerCase();
  const order = TEXT_PROVIDER_ORDER;

  if (preferred === 'deepseek' || preferred === 'anthropic' || preferred === 'openai') {
    return providerHasKey(preferred) ? preferred : null;
  }

  for (const name of order) {
    if (providerHasKey(name)) {
      return name;
    }
  }
  return null;
}

export async function completeVisionForProvider(
  provider: VisionLlmProviderName,
  request: VisionLlmRequest,
): Promise<string> {
  switch (provider) {
    case 'deepseek':
      throw new Error(
        'DeepSeek hosted API is text-only; configure ANTHROPIC_API_KEY or OPENAI_API_KEY for vision.',
      );
    case 'anthropic':
      return completeAnthropicVision(request);
    case 'openai':
      return completeOpenAiVision(request);
    default:
      throw new Error(`Unsupported vision provider: ${provider}`);
  }
}

export async function completeTextForProvider(
  provider: VisionLlmProviderName,
  request: TextLlmRequest,
): Promise<string> {
  switch (provider) {
    case 'deepseek':
      return completeDeepSeekText(request);
    case 'anthropic':
      return completeAnthropicText(request);
    case 'openai':
      return completeOpenAiText(request);
    default:
      throw new Error(`Unsupported text provider: ${provider}`);
  }
}
