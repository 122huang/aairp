import { describe, expect, it, vi } from 'vitest';
import { StubLlmGateway } from './stub-llm.gateway.js';

describe('StubLlmGateway', () => {
  it('returns stub JSON content for any prompt', async () => {
    const gateway = new StubLlmGateway({
      responsePath: '/tmp/stub.json',
      readTextFile: vi.fn().mockReturnValue('{"findings":[]}'),
    });

    const result = await gateway.complete('prompt body');

    expect(result.content).toBe('{"findings":[]}');
    expect(result.model).toBe('stub');
  });
});
