import type { ILlmGateway, LlmGatewayCompleteResult } from './stub-llm.gateway.types.js';

export class LlmGatewayTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`LLM gateway timed out after ${timeoutMs}ms`);
    this.name = 'LlmGatewayTimeoutError';
  }
}

export type ResilientLlmGatewayOptions = {
  timeoutMs: number;
  maxRetries: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new LlmGatewayTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function createResilientLlmGateway(
  gateway: ILlmGateway,
  options: ResilientLlmGatewayOptions,
): ILlmGateway {
  return {
    async complete(prompt: string): Promise<LlmGatewayCompleteResult> {
      let lastError: unknown;
      const attempts = options.maxRetries + 1;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          return await withTimeout(gateway.complete(prompt), options.timeoutMs);
        } catch (error) {
          lastError = error;
          if (attempt < attempts) {
            await delay(50);
          }
        }
      }

      throw lastError;
    },
  };
}

export function resolveOpenRiskGatewayConfig(): ResilientLlmGatewayOptions {
  const timeoutMs = Number(process.env.OPEN_RISK_TIMEOUT_MS ?? 5000);
  const maxRetries = Number(process.env.OPEN_RISK_MAX_RETRIES ?? 1);
  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000,
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 1,
  };
}
