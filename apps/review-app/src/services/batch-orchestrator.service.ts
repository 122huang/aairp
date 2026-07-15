import type { DemoReviewResponse, ReviewUploadPayload } from '@/api/review';

export type BatchItemStatus = 'pending' | 'running' | 'done' | 'failed';

export type BatchReviewItem = {
  index: number;
  text: string;
  status: BatchItemStatus;
  result?: DemoReviewResponse;
  error?: string;
  attempts: number;
};

export type BatchOrchestratorCallbacks = {
  onItemStart: (index: number) => void;
  onItemSuccess: (index: number, result: DemoReviewResponse, attempts: number) => void;
  onItemFailure: (index: number, error: string, attempts: number) => void;
};

export type ExecuteBatchReviewOptions = {
  lines: string[];
  concurrency: number;
  maxRetries: number;
  submit: (payload: ReviewUploadPayload) => Promise<DemoReviewResponse>;
  buildPayload: (text: string, index: number) => ReviewUploadPayload;
  callbacks: BatchOrchestratorCallbacks;
  isCancelled: () => boolean;
};

export const DEFAULT_BATCH_CONCURRENCY = 3;
export const DEFAULT_BATCH_MAX_RETRIES = 1;

/** Split pasted text or array into non-empty review lines (one line = one review). */
export function splitBatchInput(input: string | string[]): string[] {
  const rawLines = Array.isArray(input)
    ? input
    : input.split(/\r?\n/);

  return rawLines.map((line) => line.trim()).filter((line) => line.length > 0);
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Review request failed';
}

async function processBatchItem(
  index: number,
  text: string,
  options: ExecuteBatchReviewOptions,
): Promise<void> {
  const { maxRetries, submit, buildPayload, callbacks, isCancelled } = options;
  callbacks.onItemStart(index);

  let lastError = 'Review request failed';
  const maxAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (isCancelled()) {
      return;
    }

    try {
      const result = await submit(buildPayload(text, index));
      callbacks.onItemSuccess(index, result, attempt);
      return;
    } catch (error) {
      lastError = errorMessage(error);
      if (attempt < maxAttempts && !isCancelled()) {
        continue;
      }
    }
  }

  callbacks.onItemFailure(index, lastError, maxAttempts);
}

/**
 * Run multiple independent POST /demo/review calls with bounded concurrency and simple retry.
 */
export async function executeBatchReview(options: ExecuteBatchReviewOptions): Promise<void> {
  const { lines, concurrency, isCancelled } = options;
  if (lines.length === 0) {
    return;
  }

  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), lines.length);

  async function worker(): Promise<void> {
    while (!isCancelled()) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= lines.length) {
        return;
      }
      await processBatchItem(index, lines[index]!, options);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

export function createInitialBatchItems(lines: string[]): BatchReviewItem[] {
  return lines.map((text, index) => ({
    index: index + 1,
    text,
    status: 'pending',
    attempts: 0,
  }));
}

export function computeBatchProgress(items: BatchReviewItem[]): {
  total: number;
  completed: number;
  running: number;
  pass: number;
  warn: number;
  reject: number;
  review: number;
  failed: number;
} {
  let pass = 0;
  let warn = 0;
  let reject = 0;
  let review = 0;
  let failed = 0;
  let running = 0;
  let completed = 0;

  for (const item of items) {
    if (item.status === 'running') {
      running += 1;
    }
    if (item.status === 'done' || item.status === 'failed') {
      completed += 1;
    }
    if (item.status === 'failed') {
      failed += 1;
    }
    if (item.status === 'done' && item.result) {
      if (item.result.final_decision === 'PASS') pass += 1;
      else if (item.result.final_decision === 'WARN') warn += 1;
      else if (item.result.final_decision === 'REJECT') reject += 1;
      else if (item.result.final_decision === 'REVIEW') review += 1;
    }
  }

  return {
    total: items.length,
    completed,
    running,
    pass,
    warn,
    reject,
    review,
    failed,
  };
}
