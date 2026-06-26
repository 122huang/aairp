import { describe, expect, it, vi } from 'vitest';
import {
  createResilientLlmGateway,
  LlmGatewayTimeoutError,
} from './llm-gateway.utils.js';
import type { ILlmGateway } from './stub-llm.gateway.types.js';

describe('llm-gateway.utils', () => {
  it('retries once then succeeds', async () => {
    const gateway: ILlmGateway = {
      complete: vi
        .fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValue({ content: '{"findings":[]}' }),
    };

    const resilient = createResilientLlmGateway(gateway, {
      timeoutMs: 1000,
      maxRetries: 1,
    });

    const result = await resilient.complete('prompt');
    expect(result.content).toContain('findings');
    expect(gateway.complete).toHaveBeenCalledTimes(2);
  });

  it('throws timeout error when gateway is too slow', async () => {
    const gateway: ILlmGateway = {
      complete: vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ content: '{}' }), 200);
          }),
      ),
    };

    const resilient = createResilientLlmGateway(gateway, {
      timeoutMs: 20,
      maxRetries: 0,
    });

    await expect(resilient.complete('prompt')).rejects.toBeInstanceOf(LlmGatewayTimeoutError);
  });
});
