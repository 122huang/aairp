import { describe, expect, it } from 'vitest';
import { findTermMatch, hasAnyTerm } from './content-matching.js';

describe('content-matching word boundaries', () => {
  const textField = [{ field: 'text', value: 'Secure checkout for wellness supplements.' }];

  it('does not match cure inside secure', () => {
    expect(findTermMatch(textField, ['cure'])).toBeNull();
    expect(hasAnyTerm(textField, ['cure'])).toBe(false);
  });

  it('matches standalone cure term', () => {
    const fields = [{ field: 'text', value: 'This product can cure diabetes fast.' }];
    expect(findTermMatch(fields, ['cure'])).toMatchObject({
      text: 'cure',
      start: 16,
    });
  });

  it('matches multi-word phrases with boundaries', () => {
    const fields = [{ field: 'text', value: 'Offer is clinically proven today.' }];
    expect(findTermMatch(fields, ['clinically proven'])).toMatchObject({
      text: 'clinically proven',
    });
  });

  it('matches disclosure hashtag terms', () => {
    const fields = [{ field: 'text', value: 'Daily vitamins. #ad' }];
    expect(hasAnyTerm(fields, ['#ad', 'sponsored'])).toBe(true);
  });
});
