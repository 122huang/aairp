import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createResilientLlmGateway } from './llm-gateway.utils.js';
import type {
  ILlmGateway,
  LlmGatewayCompleteOptions,
  LlmGatewayCompleteResult,
} from './stub-llm.gateway.types.js';
import { VisionScenarioStubGateway } from './vision-scenario-stub.gateway.js';

const defaultStubPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/vision.stub.json',
);

export type VisionLlmProvider = 'deepseek';

type JsonMessage = Record<string, unknown>;

type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export function resolveVisionLlmMode(): 'live' | 'stub' | 'off' {
  const mode = process.env.AAIRP_VISION_MODE?.trim().toLowerCase();
  if (mode === 'live') {
    return 'live';
  }
  if (mode === 'stub') {
    return 'stub';
  }
  return 'off';
}

export function resolveVisionGatewayConfig(): { timeoutMs: number; maxRetries: number } {
  const isLive = resolveVisionLlmMode() === 'live';
  const defaultTimeout = isLive ? 60000 : 5000;
  const timeoutMs = Number(process.env.VISION_TIMEOUT_MS ?? defaultTimeout);
  const maxRetries = Number(process.env.VISION_MAX_RETRIES ?? 1);
  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : defaultTimeout,
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 1,
  };
}

export function resolveVisionLiveConfig(): {
  baseUrl: string;
  model: string;
  apiKey: string | null;
} {
  const apiKey =
    process.env.VISION_LLM_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim() || null;
  const baseUrl = (
    process.env.VISION_LLM_BASE_URL?.trim() || 'https://api.siliconflow.cn/v1'
  ).replace(/\/$/, '');
  const model = process.env.VISION_LLM_MODEL?.trim() || 'Qwen/Qwen3.6-35B-A3B';
  return { baseUrl, model, apiKey };
}

export function resolveVisionLlmProvider(): VisionLlmProvider | null {
  if (!resolveVisionLiveConfig().apiKey) {
    return null;
  }
  return 'deepseek';
}

function resolveVisionChatCompletionsUrl(baseUrl: string): string {
  return baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
}

export function resolveVisionImageUrl(options?: LlmGatewayCompleteOptions): string | undefined {
  if (options?.imageBase64?.trim()) {
    const raw = options.imageBase64.trim();
    if (raw.startsWith('data:image/')) {
      return raw;
    }
    return `data:image/jpeg;base64,${raw}`;
  }

  const imageUrl = options?.imageUrl?.trim();
  if (!imageUrl) {
    return undefined;
  }
  if (imageUrl.startsWith('data:image/')) {
    return imageUrl;
  }
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  return undefined;
}

async function readOpenAiText(data: JsonMessage): Promise<string> {
  const choice = (data.choices as JsonMessage[] | undefined)?.[0];
  const message = choice?.message as JsonMessage | undefined;
  const content = message?.content;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }
  const reasoning = message?.reasoning_content;
  if (typeof reasoning === 'string' && reasoning.trim()) {
    throw new Error(
      'Vision LLM returned reasoning_content only; disable thinking (enable_thinking=false) or increase max_tokens',
    );
  }
  throw new Error('Vision LLM response missing message content');
}

function buildVisionRequestBody(
  model: string,
  maxTokens: number,
  content: MultimodalContentPart[],
): JsonMessage {
  const body: JsonMessage = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content }],
  };
  if (/qwen/i.test(model)) {
    body.enable_thinking = false;
  }
  return body;
}

async function completeVisionLive(
  prompt: string,
  options: LlmGatewayCompleteOptions | undefined,
  maxTokens: number,
): Promise<string> {
  const { baseUrl, model, apiKey } = resolveVisionLiveConfig();
  if (!apiKey) {
    throw new Error(
      'VISION_LLM_API_KEY or DEEPSEEK_API_KEY is not configured for VISION live mode',
    );
  }

  const content: MultimodalContentPart[] = [];
  const imageUrl = resolveVisionImageUrl(options);
  if (imageUrl) {
    content.push({ type: 'image_url', image_url: { url: imageUrl } });
  }
  content.push({ type: 'text', text: prompt });

  const response = await fetch(resolveVisionChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildVisionRequestBody(model, maxTokens, content)),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vision LLM API ${response.status}: ${errText.slice(0, 500)}`);
  }

  return readOpenAiText((await response.json()) as JsonMessage);
}

export class VisionLlmGateway implements ILlmGateway {
  constructor(
    private readonly config: {
      provider?: VisionLlmProvider;
      maxTokens?: number;
    } = {},
  ) {}

  async complete(
    prompt: string,
    options?: LlmGatewayCompleteOptions,
  ): Promise<LlmGatewayCompleteResult> {
    if (resolveVisionLlmMode() !== 'live') {
      throw new Error('VisionLlmGateway called while AAIRP_VISION_MODE is not live');
    }

    const provider = this.config.provider ?? resolveVisionLlmProvider();
    if (!provider) {
      throw new Error(
        'VISION live mode requires VISION_LLM_API_KEY (or DEEPSEEK_API_KEY) and AAIRP_VISION_MODE=live',
      );
    }

    const maxTokens = this.config.maxTokens ?? Number(process.env.VISION_MAX_TOKENS ?? 2048);
    const content = await completeVisionLive(prompt, options, maxTokens);
    return { content };
  }
}

export function createDefaultVisionLlmGateway(options?: {
  stubResponsePath?: string;
  readTextFile?: (path: string) => string;
}): ILlmGateway | null {
  const mode = resolveVisionLlmMode();
  if (mode === 'off') {
    return null;
  }

  const readTextFile = options?.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
  const stubResponsePath = options?.stubResponsePath ?? defaultStubPath;
  const inner: ILlmGateway =
    mode === 'live'
      ? new VisionLlmGateway()
      : new VisionScenarioStubGateway({
          fallbackStubPath: stubResponsePath,
          readTextFile,
        });

  return createResilientLlmGateway(inner, resolveVisionGatewayConfig());
}
