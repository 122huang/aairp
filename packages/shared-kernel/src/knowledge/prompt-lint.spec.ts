import { describe, expect, it } from 'vitest';
import {
  PROMPT_CONTENT_MAX_BYTES,
  PromptValidationError,
  assertValidPromptContent,
  lintPromptContent,
} from './prompt-lint.js';

describe('lintPromptContent', () => {
  it('rejects empty content', () => {
    const lint = lintPromptContent('   \n  ');
    expect(lint.valid).toBe(false);
    expect(lint.issues[0]?.code).toBe('EMPTY_CONTENT');
  });

  it('accepts non-empty demo-sized content', () => {
    const lint = lintPromptContent('You are an open-risk agent.\n');
    expect(lint.valid).toBe(true);
    expect(lint.line_count).toBe(2);
  });

  it('rejects content above max bytes', () => {
    const content = 'x'.repeat(PROMPT_CONTENT_MAX_BYTES + 1);
    const lint = lintPromptContent(content);
    expect(lint.valid).toBe(false);
    expect(lint.issues[0]?.code).toBe('CONTENT_TOO_LARGE');
  });

  it('throws PromptValidationError from assertValidPromptContent', () => {
    expect(() => assertValidPromptContent('')).toThrow(PromptValidationError);
  });
});
