import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createResilientLlmGateway, resolveOpenRiskGatewayConfig } from './llm-gateway.utils.js';
import { StubLlmGateway } from './stub-llm.gateway.js';
import type { ILlmGateway, LlmGatewayCompleteResult } from './stub-llm.gateway.types.js';

export type OpenRiskLlmProvider = 'deepseek' | 'anthropic' | 'openai';

type JsonMessage = Record<string, unknown>;

const PROVIDER_ORDER: OpenRiskLlmProvider[] = ['deepseek', 'anthropic', 'openai'];

const defaultStubPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/open-risk.stub.json',
);

function providerHasKey(provider: OpenRiskLlmProvider): boolean {
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

export function resolveOpenRiskTextProvider(): OpenRiskLlmProvider | null {
  const preferred = process.env.OPEN_RISK_LLM_PROVIDER?.trim().toLowerCase();
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

/** `live` only when AAIRP_OPEN_RISK_MODE=live (explicit opt-in). Otherwise stub. */
export function resolveOpenRiskLlmMode(): 'live' | 'stub' {
  return process.env.AAIRP_OPEN_RISK_MODE?.trim().toLowerCase() === 'live' ? 'live' : 'stub';
}

export function resolveOpenRiskModel(provider: OpenRiskLlmProvider): string {
  const configured = process.env.OPEN_RISK_LLM_MODEL?.trim();
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

async function completeAnthropicText(
  prompt: string,
  maxTokens: number,
): Promise<{ content: string; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured for OPEN_RISK live mode');
  }

  const model = resolveOpenRiskModel('anthropic');
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
    throw new Error(`Open Risk Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }

  return { content: await readAnthropicText((await response.json()) as JsonMessage), model };
}

async function completeOpenAiCompatibleText(
  prompt: string,
  maxTokens: number,
  options: { apiKey: string; baseUrl: string; model: string; label: string },
): Promise<{ content: string; model: string }> {
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
    throw new Error(`Open Risk ${options.label} API ${response.status}: ${errText.slice(0, 300)}`);
  }

  return {
    content: await readOpenAiText((await response.json()) as JsonMessage),
    model: options.model,
  };
}

async function completeOpenRiskProviderText(
  provider: OpenRiskLlmProvider,
  prompt: string,
  maxTokens: number,
): Promise<{ content: string; model: string }> {
  switch (provider) {
    case 'deepseek': {
      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY is not configured for OPEN_RISK live mode');
      }
      const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(
        /\/$/,
        '',
      );
      return completeOpenAiCompatibleText(prompt, maxTokens, {
        apiKey,
        baseUrl,
        model: resolveOpenRiskModel('deepseek'),
        label: 'DeepSeek',
      });
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured for OPEN_RISK live mode');
      }
      const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com').replace(
        /\/$/,
        '',
      );
      return completeOpenAiCompatibleText(prompt, maxTokens, {
        apiKey,
        baseUrl,
        model: resolveOpenRiskModel('openai'),
        label: 'OpenAI',
      });
    }
    case 'anthropic':
      return completeAnthropicText(prompt, maxTokens);
    default:
      throw new Error(`Unsupported OPEN_RISK provider: ${provider}`);
  }
}

export class OpenRiskLlmGateway implements ILlmGateway {
  constructor(
    private readonly config: {
      provider?: OpenRiskLlmProvider;
      maxTokens?: number;
    } = {},
  ) {}

  async complete(prompt: string): Promise<LlmGatewayCompleteResult> {
    if (resolveOpenRiskLlmMode() !== 'live') {
      throw new Error('OpenRiskLlmGateway called while AAIRP_OPEN_RISK_MODE is not live');
    }

    const provider = this.config.provider ?? resolveOpenRiskTextProvider();
    if (!provider) {
      throw new Error(
        'OPEN_RISK live mode requires OPEN_RISK_LLM_PROVIDER plus a matching API key (DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)',
      );
    }

    const maxTokens = this.config.maxTokens ?? Number(process.env.OPEN_RISK_MAX_TOKENS ?? 2048);
    const { content, model } = await completeOpenRiskProviderText(provider, prompt, maxTokens);
    return { content, model };
  }
}

export function createDefaultOpenRiskLlmGateway(options?: {
  stubResponsePath?: string;
  readTextFile?: (path: string) => string;
}): ILlmGateway {
  const readTextFile = options?.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
  const stubResponsePath = options?.stubResponsePath ?? defaultStubPath;
  const inner: ILlmGateway =
    resolveOpenRiskLlmMode() === 'live'
      ? new OpenRiskLlmGateway()
      : new StubLlmGateway({ responsePath: stubResponsePath, readTextFile });

  return createResilientLlmGateway(inner, resolveOpenRiskGatewayConfig());
}
