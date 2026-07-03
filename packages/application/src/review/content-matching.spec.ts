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
      start: 17,
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

  it('matches superlative phrases with punctuation (no.1)', () => {
    const fields = [{ field: 'text', value: 'the best machine ever, world no.1' }];
    expect(findTermMatch(fields, ['best machine ever'])).toMatchObject({
      text: 'best machine ever',
    });
    expect(findTermMatch(fields, ['world no.1'])).toMatchObject({ text: 'world no.1' });
    expect(findTermMatch(fields, ['no.1'])).toMatchObject({ text: 'no.1' });
  });

  it('does not require contiguous best ever when the best is listed', () => {
    const fields = [{ field: 'text', value: 'the best machine ever' }];
    expect(findTermMatch(fields, ['best ever'])).toBeNull();
    expect(findTermMatch(fields, ['the best'])).toMatchObject({ text: 'the best' });
  });

  it('matches Chinese omnibus term 每一次', () => {
    const fields = [{ field: 'text', value: '清洁力经得起每一次家庭考验。' }];
    expect(findTermMatch(fields, ['每一次'])).toMatchObject({ text: '每一次' });
  });

  it('matches CJK term before digits (媲美3颗)', () => {
    const fields = [{ field: 'text', value: '维他命C含量媲美3颗新鲜奇异果' }];
    expect(findTermMatch(fields, ['媲美'])).toMatchObject({ text: '媲美' });
  });

  it('does not match CJK term embedded inside ASCII word', () => {
    const fields = [{ field: 'text', value: 'x媲美y' }];
    expect(findTermMatch(fields, ['媲美'])).toBeNull();
  });

  it('matches cleaner than but not a cleaner home lifestyle phrasing', () => {
    const lifestyle = [{ field: 'text', value: 'A cleaner home starts with every single pass.' }];
    expect(findTermMatch(lifestyle, ['cleaner than'])).toBeNull();
    expect(findTermMatch(lifestyle, ['cleaner way to cook'])).toBeNull();

    const comparative = [{ field: 'text', value: 'A cleaner than ordinary mop experience' }];
    expect(findTermMatch(comparative, ['cleaner than'])).toMatchObject({ text: 'cleaner than' });
  });
});
