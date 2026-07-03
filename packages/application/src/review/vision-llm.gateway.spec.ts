import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  VisionLlmGateway,
  createDefaultVisionLlmGateway,
  resolveVisionImageUrl,
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
    process.env.VISION_LLM_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    expect(resolveVisionLlmMode()).toBe('live');
    expect(resolveVisionLlmProvider()).toBe('deepseek');
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

  it('calls DeepSeek multimodal chat completions in live mode', async () => {
    process.env.AAIRP_VISION_MODE = 'live';
    process.env.VISION_LLM_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.VISION_LLM_MODEL = 'deepseek-vl2';

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
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.model).toBe('deepseek-vl2');
    expect(requestBody.messages[0].content).toEqual(
      expect.arrayContaining([
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: 'scan this slice' },
      ]),
    );
  });

  it('fails clearly when live mode has no API key', async () => {
    process.env.AAIRP_VISION_MODE = 'live';
    process.env.VISION_LLM_PROVIDER = 'deepseek';
    delete process.env.DEEPSEEK_API_KEY;

    const gateway = new VisionLlmGateway();
    await expect(gateway.complete('scan')).rejects.toThrow('DEEPSEEK_API_KEY');
  });

  it('createDefaultVisionLlmGateway returns stub JSON in stub mode', async () => {
    process.env.AAIRP_VISION_MODE = 'stub';
    const gateway = createDefaultVisionLlmGateway();
    expect(gateway).not.toBeNull();
    const result = await gateway!.complete('ignored');
    expect(result.content).toContain('findings');
  });
});
