import { describe, expect, it } from 'vitest';
import { detectReviewCopyLocale, pickLocalizedCopy } from './content-locale.js';

describe('content-locale', () => {
  it('detects Chinese-primary copy', () => {
    expect(detectReviewCopyLocale('谢谢品牌送的这台产品，这几天真的爱不释手。')).toBe('zh');
  });

  it('detects English-primary copy', () => {
    expect(detectReviewCopyLocale('Daily vitamins for general wellness support.')).toBe('en');
  });

  it('picks zh/en with fallback', () => {
    expect(pickLocalizedCopy('zh', { en: 'Hello', zh: '你好', fallback: 'fallback' })).toBe('你好');
    expect(pickLocalizedCopy('en', { en: 'Hello', zh: '你好', fallback: 'fallback' })).toBe('Hello');
    expect(pickLocalizedCopy('zh', { en: 'Hello', fallback: 'fallback' })).toBe('fallback');
  });
});
