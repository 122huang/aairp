import { afterEach, describe, expect, it } from 'vitest';
import { resolveTextLlmProvider, resolveVisionLlmProvider } from './llm-providers.js';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
});

describe('resolveVisionLlmProvider', () => {
  it('does not use deepseek for vision even when preferred', () => {
    process.env.OCR_VISION_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(resolveVisionLlmProvider()).toBeNull();
  });

  it('selects anthropic when key is set', () => {
    delete process.env.OCR_VISION_PROVIDER;
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(resolveVisionLlmProvider()).toBe('anthropic');
  });
});

describe('resolveTextLlmProvider', () => {
  it('prefers deepseek when OCR_VISION_PROVIDER=deepseek', () => {
    process.env.OCR_VISION_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    delete process.env.ANTHROPIC_API_KEY;
    expect(resolveTextLlmProvider()).toBe('deepseek');
  });

  it('auto-selects deepseek when only deepseek key is set', () => {
    delete process.env.OCR_VISION_PROVIDER;
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    delete process.env.ANTHROPIC_API_KEY;
    expect(resolveTextLlmProvider()).toBe('deepseek');
  });

  it('does not inherit OCR_VISION_PROVIDER for text cleanup', () => {
    process.env.OCR_VISION_PROVIDER = 'anthropic';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(resolveTextLlmProvider()).toBe('deepseek');
  });
});
