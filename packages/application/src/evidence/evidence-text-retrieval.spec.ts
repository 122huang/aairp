import { describe, expect, it } from 'vitest';
import {
  chunkEvidenceText,
  EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT,
  scoreEvidenceChunk,
  selectEvidenceTextForPrompt,
  tokenizeForEvidenceRetrieval,
} from './evidence-text-retrieval.js';

describe('evidence text retrieval', () => {
  it('tokenizeForEvidenceRetrieval keeps numbers and words', () => {
    expect(tokenizeForEvidenceRetrieval('Up to 8-10 people, 245g')).toEqual(
      expect.arrayContaining(['up', '8-10', 'people', '245g']),
    );
  });

  it('chunkEvidenceText splits long paragraphs with overlap', () => {
    const text = 'A'.repeat(4000);
    const chunks = chunkEvidenceText(text, 1500);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]?.text.length).toBeLessThanOrEqual(1500);
  });

  it('scoreEvidenceChunk boosts exact claim and numeric overlap', () => {
    const tokens = tokenizeForEvidenceRetrieval('8-10 people');
    const high = scoreEvidenceChunk(
      'Total weight ÷ 245g = feed up to 8-10 people',
      'up to 8-10 people',
      tokens,
    );
    const low = scoreEvidenceChunk('Unrelated recipe timing 35 minutes', 'up to 8-10 people', tokens);
    expect(high).toBeGreaterThan(low);
  });

  it('selectEvidenceTextForPrompt prefers claim-relevant tail over filler prefix', () => {
    const filler = `${'x'.repeat(EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT)}`;
    const tail = 'Method: calibrated scale, 245g reference, supports 8-10 people.';
    const text = `${filler}${tail}`;
    const window = selectEvidenceTextForPrompt(text, '8-10 people');
    expect(window.truncated).toBe(true);
    expect(window.text_for_prompt).toContain('8-10 people');
    expect(window.text_for_prompt).not.toBe('x'.repeat(EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT));
  });
});
