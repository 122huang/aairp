import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  VisionLlmGateway,
  createDefaultVisionLlmGateway,
  resolveVisionImageUrl,
  resolveVisionLiveConfig,
  resolveVisionLlmMode,
  resolveVisionLlmProvider,
} from './vision-llm.gateway.js';

describe('vision-llm.gateway', () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
    vi.restoreAllMocks();
  });

  it('defaults to off mode without explicit config', () => {
    delete process.env.AAIRP_VISION_MODE;
    expect(resolveVisionLlmMode()).toBe('off');
  });

  it('resolves live mode and provider when configured', () => {
    process.env.AAIRP_VISION_MODE = 'live';
    process.env.VISION_LLM_API_KEY = 'test-key';
    expect(resolveVisionLlmMode()).toBe('live');
    expect(resolveVisionLlmProvider()).toBe('deepseek');
  });

  it('defaults SiliconFlow base URL and Qwen3.6 vision model', () => {
    delete process.env.VISION_LLM_BASE_URL;
    delete process.env.VISION_LLM_MODEL;
    expect(resolveVisionLiveConfig()).toMatchObject({
      baseUrl: 'https://api.siliconflow.cn/v1',
      model: 'Qwen/Qwen3.6-35B-A3B',
    });
  });

  it('resolveVisionImageUrl accepts data URLs and http URLs', () => {
    const dataUrl = 'data:image/jpeg;base64,abc123';
    expect(resolveVisionImageUrl({ imageUrl: dataUrl })).toBe(dataUrl);
    expect(resolveVisionImageUrl({ imageBase64: 'rawbase64' })).toBe(
      'data:image/jpeg;base64,rawbase64',
    );
    expect(resolveVisionImageUrl({ imageUrl: 'https://cdn.example.com/a.jpg' })).toBe(
      'https://cdn.example.com/a.jpg',
    );
  });

  it('calls SiliconFlow multimodal chat completions in live mode', async () => {
    process.env.AAIRP_VISION_MODE = 'live';
    process.env.VISION_LLM_API_KEY = 'test-key';
    process.env.VISION_LLM_BASE_URL = 'https://api.siliconflow.cn/v1';
    process.env.VISION_LLM_MODEL = 'Qwen/Qwen3.6-35B-A3B';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"findings":[]}' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const gateway = new VisionLlmGateway();
    const imageUrl = 'data:image/jpeg;base64,abc123';
    const result = await gateway.complete('scan this slice', { imageUrl });

    expect(result.content).toContain('findings');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.siliconflow.cn/v1/chat/completions',
    );
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.model).toBe('Qwen/Qwen3.6-35B-A3B');
    expect(requestBody.enable_thinking).toBe(false);
    expect(requestBody.messages[0].content).toEqual(
      expect.arrayContaining([
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: 'scan this slice' },
      ]),
    );
  });

  it('fails clearly when live mode has no API key', async () => {
    process.env.AAIRP_VISION_MODE = 'live';
    delete process.env.VISION_LLM_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    const gateway = new VisionLlmGateway();
    await expect(gateway.complete('scan')).rejects.toThrow('VISION_LLM_API_KEY');
  });

  it('createDefaultVisionLlmGateway returns stub JSON in stub mode', async () => {
    process.env.AAIRP_VISION_MODE = 'stub';
    const gateway = createDefaultVisionLlmGateway();
    expect(gateway).not.toBeNull();
    const result = await gateway!.complete('ignored');
    expect(result.content).toContain('findings');
  });
});
