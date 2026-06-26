export type PromptLintIssueCode = 'EMPTY_CONTENT' | 'CONTENT_TOO_LARGE';

export type PromptLintIssue = {
  code: PromptLintIssueCode;
  message: string;
};

export type PromptLintResult = {
  valid: boolean;
  content_length: number;
  line_count: number;
  byte_length: number;
  issues: PromptLintIssue[];
};

export const PROMPT_CONTENT_MAX_BYTES = 256 * 1024;

export class PromptValidationError extends Error {
  readonly lint: PromptLintResult;

  constructor(lint: PromptLintResult) {
    super(lint.issues.map((issue) => issue.message).join('; '));
    this.name = 'PromptValidationError';
    this.lint = lint;
  }
}

export function measurePromptContent(content: string): Omit<PromptLintResult, 'valid' | 'issues'> {
  return {
    content_length: content.length,
    line_count: content.length === 0 ? 0 : content.split('\n').length,
    byte_length: new TextEncoder().encode(content).byteLength,
  };
}

export function lintPromptContent(content: string): PromptLintResult {
  const metrics = measurePromptContent(content);
  const issues: PromptLintIssue[] = [];

  if (content.trim().length === 0) {
    issues.push({
      code: 'EMPTY_CONTENT',
      message: 'Prompt content must not be empty',
    });
  }

  if (metrics.byte_length > PROMPT_CONTENT_MAX_BYTES) {
    issues.push({
      code: 'CONTENT_TOO_LARGE',
      message: `Prompt content exceeds ${PROMPT_CONTENT_MAX_BYTES} bytes`,
    });
  }

  return {
    valid: issues.length === 0,
    ...metrics,
    issues,
  };
}

export function assertValidPromptContent(content: string): PromptLintResult {
  const lint = lintPromptContent(content);
  if (!lint.valid) {
    throw new PromptValidationError(lint);
  }
  return lint;
}

export function toPromptContentMetadata(content: string): {
  content_length: number;
  line_count: number;
  byte_length: number;
} {
  const { content_length, line_count, byte_length } = measurePromptContent(content);
  return { content_length, line_count, byte_length };
}
