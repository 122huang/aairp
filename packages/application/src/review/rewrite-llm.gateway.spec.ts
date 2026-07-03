import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeRewriteResponsePayload,
  parseRewriteResponseContent,
} from './rewrite-response.parser.js';
import {
  RewriteLlmGateway,
  createDefaultRewriteLlmGateway,
  resolveRewriteLlmMode,
  resolveRewriteTextProvider,
} from './rewrite-llm.gateway.js';

describe('rewrite-response.parser (live bounds)', () => {
  const basePayload = {
    risk_type: 'health-implication',
    rewrite_strategy: 'remove',
    rewrite_template_id: 'remove-health-claim',
    original_span: '更轻盈',
    rationale: 'Remove implied health benefit.',
    confidence: 0.9,
  };

  it('truncates suggested_text to first 3 items', () => {
    const parsed = parseRewriteResponseContent(
      JSON.stringify({
        ...basePayload,
        suggested_text: ['a', 'b', 'c', 'd', 'e'],
      }),
    );
    expect(parsed.suggested_text).toEqual(['a', 'b', 'c']);
  });

  it('clamps confidence to 0–1', () => {
    const high = normalizeRewriteResponsePayload({
      ...basePayload,
      suggested_text: ['x'],
      confidence: 1.8,
    });
    expect(high.confidence).toBe(1);

    const low = normalizeRewriteResponsePayload({
      ...basePayload,
      suggested_text: ['x'],
      confidence: -0.2,
    });
    expect(low.confidence).toBe(0);
  });
});

describe('rewrite-llm.gateway', () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
    vi.restoreAllMocks();
  });

  it('defaults to off without explicit mode', () => {
    delete process.env.AAIRP_REWRITE_MODE;
    expect(resolveRewriteLlmMode()).toBe('off');
    expect(resolveRewriteTextProvider()).toBeNull();
  });

  it('uses stub mode when explicitly enabled', () => {
    process.env.AAIRP_REWRITE_MODE = 'stub';
    expect(resolveRewriteLlmMode()).toBe('stub');
  });

  it('uses live mode when explicitly enabled', () => {
    process.env.AAIRP_REWRITE_MODE = 'live';
    process.env.REWRITE_LLM_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    expect(resolveRewriteLlmMode()).toBe('live');
    expect(resolveRewriteTextProvider()).toBe('deepseek');
  });

  it('calls DeepSeek chat completions in live mode', async () => {
    process.env.AAIRP_REWRITE_MODE = 'live';
    process.env.REWRITE_LLM_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                risk_type: 'health-implication',
                rewrite_strategy: 'remove',
                rewrite_template_id: 'remove-health-claim',
                original_span: '更轻盈',
                suggested_text: ['热风循环技术，无需预热，即放即炸。'],
                rationale: '功能-only rewrite.',
                confidence: 0.91,
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const gateway = new RewriteLlmGateway();
    const result = await gateway.complete('rewrite this span');

    expect(result.content).toContain('suggested_text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.response_format).toEqual({ type: 'json_object' });
  });

  it('createDefaultRewriteLlmGateway wraps live gateway with resilience', () => {
    process.env.AAIRP_REWRITE_MODE = 'live';
    process.env.REWRITE_LLM_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    const gateway = createDefaultRewriteLlmGateway();
    expect(gateway).toBeDefined();
  });
});
