import { describe, expect, it } from 'vitest';
import { cleanIncludedLabel, heuristicUnderstand } from './ocr-understand.js';

describe('cleanIncludedLabel', () => {
  it('strips callout OCR junk from part labels', () => {
    expect(cleanIncludedLabel('mm Measuring Cup | | 本 ge |')).toBe('Measuring Cup');
    expect(cleanIncludedLabel('Crystal Ceramic | a _|')).toBe('Crystal Ceramic');
    expect(cleanIncludedLabel('Inner Pot | | \\')).toBe('Inner Pot');
  });
});

describe('heuristicUnderstand', () => {
  it('groups Whats Included block into included_items', () => {
    const result = heuristicUnderstand(
      "What's Included\nMain Unit\nmm Measuring Cup | | 本 ge |\nCrystal Ceramic | a _|\nInner Pot | | \\",
    );

    expect(result.structured.included_title).toBe("What's Included");
    expect(result.structured.included_items).toEqual([
      'Main Unit',
      'Measuring Cup',
      'Crystal Ceramic',
      'Inner Pot',
    ]);
    expect(result.confirmed_text).toContain('[What\'s Included]');
  });

  it('dedupes lines and buckets copy heuristically', () => {
    const result = heuristicUnderstand(
      'Every time perfect\nEvery time perfect\nDelivers plump rice with 3L capacity',
    );

    expect(result.confirmed_text).toContain('Every time perfect');
    expect(result.structured.headlines).toContain('Every time perfect');
    expect(result.structured.specs.length + result.structured.selling_points.length).toBeGreaterThan(
      0,
    );
    expect(result.understand_provider).toBe('heuristic');
  });
});
