import { describe, expect, it } from 'vitest';
import {
  UPLOAD_LIMITS,
  validateAdvertisementUpload,
} from './validate-advertisement-upload.js';

describe('validateAdvertisementUpload', () => {
  it('accepts a valid payload', () => {
    const result = validateAdvertisementUpload({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: { text: 'hello' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.countryId).toBe('SG');
      expect(result.input.content.text).toBe('hello');
    }
  });

  it('rejects missing country_id', () => {
    const result = validateAdvertisementUpload({
      platform_id: 'META',
      category_id: 'health.supplement',
      content: { text: 'hello' },
    });

    expect(result.ok).toBe(false);
  });

  it('accepts images-only content', () => {
    const result = validateAdvertisementUpload({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: { images: ['https://cdn.example.com/ad.png'] },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.content.text).toBe('');
      expect(result.input.content.images).toHaveLength(1);
    }
  });

  it('rejects non-object body', () => {
    const result = validateAdvertisementUpload(null);
    expect(result.ok).toBe(false);
  });

  it('rejects text exceeding max length', () => {
    const result = validateAdvertisementUpload({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: { text: 'x'.repeat(UPLOAD_LIMITS.MAX_TEXT_LENGTH + 1) },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.field === 'content.text')).toBe(true);
    }
  });

  it('accepts base64 data URL images', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const result = validateAdvertisementUpload({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: { images: [dataUrl] },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.content.images[0]).toBe(dataUrl);
    }
  });

  it('rejects too many images', () => {
    const result = validateAdvertisementUpload({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: {
        images: Array.from(
          { length: UPLOAD_LIMITS.MAX_IMAGES + 1 },
          (_, index) => `https://cdn.example.com/${index}.png`,
        ),
      },
    });

    expect(result.ok).toBe(false);
  });
});
