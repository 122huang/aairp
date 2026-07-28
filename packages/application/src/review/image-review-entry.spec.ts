import { describe, expect, it, afterEach } from 'vitest';
import {
  getImageReviewRuntimeInfo,
  isImageReviewEntryEnabled,
  parseReviewEntryMode,
  readEntryModeFromTags,
  resolveImageReviewEntryMode,
} from './image-review-entry.js';

const original = process.env.AAIRP_IMAGE_REVIEW_ENTRY;

afterEach(() => {
  if (original === undefined) {
    delete process.env.AAIRP_IMAGE_REVIEW_ENTRY;
  } else {
    process.env.AAIRP_IMAGE_REVIEW_ENTRY = original;
  }
});

describe('image-review-entry flag', () => {
  it('defaults to off when unset', () => {
    delete process.env.AAIRP_IMAGE_REVIEW_ENTRY;
    expect(resolveImageReviewEntryMode()).toBe('off');
    expect(isImageReviewEntryEnabled()).toBe(false);
    expect(getImageReviewRuntimeInfo().image_review_entry_source).toBe(
      'default_off_when_unset',
    );
  });

  it('enables when on', () => {
    process.env.AAIRP_IMAGE_REVIEW_ENTRY = 'on';
    expect(isImageReviewEntryEnabled()).toBe(true);
    expect(getImageReviewRuntimeInfo().image_review_entry).toBe('on');
  });

  it('parses entry modes and tags', () => {
    expect(parseReviewEntryMode('image')).toBe('image');
    expect(parseReviewEntryMode('nope')).toBeUndefined();
    expect(readEntryModeFromTags(['market:SG', 'entry_mode:image'])).toBe('image');
  });
});
