import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseOpenRiskResponseContent } from './open-risk-response.parser.js';
import {
  OpenRiskLlmGateway,
  resolveOpenRiskLlmMode,
  resolveOpenRiskTextProvider,
} from './open-risk-llm.gateway.js';
import { createDefaultOpenRiskLlmGateway } from './open-risk-llm.gateway.js';

describe('open-risk-response.parser', () => {
  it('parses bare JSON', () => {
    const payload = parseOpenRiskResponseContent('{"findings":[]}');
    expect(payload.findings).toEqual([]);
  });

  it('parses fenced JSON', () => {
    const payload = parseOpenRiskResponseContent(
      'Here is the result:\n```json\n{"findings":[{"risk_type":"health-implication","description":"x","severity":"MEDIUM","suggested_action":"WARN","confidence":0.8}]}\n```',
    );
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]?.risk_type).toBe('health-implication');
  });
});

describe('open-risk-llm.gateway', () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
    vi.restoreAllMocks();
  });

  it('defaults to stub mode without API keys', () => {
    delete process.env.AAIRP_OPEN_RISK_MODE;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(resolveOpenRiskLlmMode()).toBe('stub');
    expect(resolveOpenRiskTextProvider()).toBeNull();
  });

  it('uses live mode when explicitly enabled', () => {
    process.env.AAIRP_OPEN_RISK_MODE = 'live';
    process.env.OPEN_RISK_LLM_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    expect(resolveOpenRiskLlmMode()).toBe('live');
    expect(resolveOpenRiskTextProvider()).toBe('deepseek');
  });

  it('calls DeepSeek chat completions in live mode', async () => {
    process.env.AAIRP_OPEN_RISK_MODE = 'live';
    process.env.OPEN_RISK_LLM_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"findings":[]}' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const gateway = new OpenRiskLlmGateway();
    const result = await gateway.complete('classify this ad');

    expect(result.content).toContain('findings');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.response_format).toEqual({ type: 'json_object' });
  });

  it('createDefaultOpenRiskLlmGateway returns stub JSON without live mode', async () => {
    process.env.AAIRP_OPEN_RISK_MODE = 'stub';
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const gateway = createDefaultOpenRiskLlmGateway();
    const result = await gateway.complete('ignored');
    expect(result.content).toContain('findings');
  });
});
