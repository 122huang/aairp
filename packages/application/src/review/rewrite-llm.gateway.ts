import { createResilientLlmGateway, resolveRewriteGatewayConfig } from './llm-gateway.utils.js';
import type { ILlmGateway, LlmGatewayCompleteResult } from './stub-llm.gateway.types.js';

export type RewriteLlmProvider = 'deepseek' | 'anthropic' | 'openai';

type JsonMessage = Record<string, unknown>;

const PROVIDER_ORDER: RewriteLlmProvider[] = ['deepseek', 'anthropic', 'openai'];

function providerHasKey(provider: RewriteLlmProvider): boolean {
  switch (provider) {
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

export function resolveRewriteTextProvider(): RewriteLlmProvider | null {
  const preferred = process.env.REWRITE_LLM_PROVIDER?.trim().toLowerCase();
  if (preferred === 'deepseek' || preferred === 'anthropic' || preferred === 'openai') {
    return providerHasKey(preferred) ? preferred : null;
  }

  for (const provider of PROVIDER_ORDER) {
    if (providerHasKey(provider)) {
      return provider;
    }
  }
  return null;
}

/** Defaults to `off`. `stub` and `live` require explicit AAIRP_REWRITE_MODE. */
export function resolveRewriteLlmMode(): 'off' | 'stub' | 'live' {
  const mode = process.env.AAIRP_REWRITE_MODE?.trim().toLowerCase();
  if (mode === 'stub' || mode === 'live') {
    return mode;
  }
  return 'off';
}

function resolveRewriteModel(provider: RewriteLlmProvider): string {
  const configured = process.env.REWRITE_LLM_MODEL?.trim();
  if (configured) {
    return configured;
  }
  switch (provider) {
    case 'deepseek':
      return 'deepseek-chat';
    case 'anthropic':
      return 'claude-3-5-haiku-20241022';
    case 'openai':
      return 'gpt-4o-mini';
    default:
      return 'gpt-4o-mini';
  }
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
    throw new Error('OpenAI-compatible response missing message content');
  }
  return content;
}

async function completeAnthropicText(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured for REWRITE live mode');
  }

  const model = resolveRewriteModel('anthropic');
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
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Rewrite Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }

  return readAnthropicText((await response.json()) as JsonMessage);
}

async function completeOpenAiCompatibleText(
  prompt: string,
  maxTokens: number,
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
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Rewrite ${options.label} API ${response.status}: ${errText.slice(0, 300)}`);
  }

  return readOpenAiText((await response.json()) as JsonMessage);
}

async function completeRewriteProviderText(
  provider: RewriteLlmProvider,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  switch (provider) {
    case 'deepseek': {
      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY is not configured for REWRITE live mode');
      }
      const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(
        /\/$/,
        '',
      );
      return completeOpenAiCompatibleText(prompt, maxTokens, {
        apiKey,
        baseUrl,
        model: resolveRewriteModel('deepseek'),
        label: 'DeepSeek',
      });
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured for REWRITE live mode');
      }
      const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com').replace(
        /\/$/,
        '',
      );
      return completeOpenAiCompatibleText(prompt, maxTokens, {
        apiKey,
        baseUrl,
        model: resolveRewriteModel('openai'),
        label: 'OpenAI',
      });
    }
    case 'anthropic':
      return completeAnthropicText(prompt, maxTokens);
    default:
      throw new Error(`Unsupported REWRITE provider: ${provider}`);
  }
}

export class RewriteLlmGateway implements ILlmGateway {
  constructor(
    private readonly config: {
      provider?: RewriteLlmProvider;
      maxTokens?: number;
    } = {},
  ) {}

  async complete(prompt: string): Promise<LlmGatewayCompleteResult> {
    if (resolveRewriteLlmMode() !== 'live') {
      throw new Error('RewriteLlmGateway called while AAIRP_REWRITE_MODE is not live');
    }

    const provider = this.config.provider ?? resolveRewriteTextProvider();
    if (!provider) {
      throw new Error(
        'REWRITE live mode requires REWRITE_LLM_PROVIDER plus a matching API key (DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)',
      );
    }

    const maxTokens = this.config.maxTokens ?? Number(process.env.REWRITE_MAX_TOKENS ?? 1024);
    const content = await completeRewriteProviderText(provider, prompt, maxTokens);
    return { content };
  }
}

export function createDefaultRewriteLlmGateway(): ILlmGateway {
  const inner: ILlmGateway = new RewriteLlmGateway();
  return createResilientLlmGateway(inner, resolveRewriteGatewayConfig());
}
