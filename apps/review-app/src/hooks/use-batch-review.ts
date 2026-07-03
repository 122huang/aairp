import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DEMO_REVIEW_PLATFORM_ID,
  type DemoReviewCountryId,
  type DemoSaCategoryId,
} from '@aairp/shared-kernel';
import { submitReview, type ReviewUploadPayload } from '@/api/review';
import {
  computeBatchProgress,
  createInitialBatchItems,
  DEFAULT_BATCH_CONCURRENCY,
  DEFAULT_BATCH_MAX_RETRIES,
  executeBatchReview,
  splitBatchInput,
  type BatchReviewItem,
} from '@/services/batch-orchestrator.service';

export type BatchReviewConfig = {
  countryId: DemoReviewCountryId;
  categoryId: DemoSaCategoryId;
  concurrency?: number;
  maxRetries?: number;
};

export function useBatchReview() {
  const [items, setItems] = useState<BatchReviewItem[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const cancelledRef = useRef(false);

  const progress = useMemo(() => computeBatchProgress(items), [items]);

  const updateItem = useCallback((index: number, patch: Partial<BatchReviewItem>) => {
    setItems((current) =>
      current.map((item) => (item.index === index ? { ...item, ...patch } : item)),
    );
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setItems([]);
    setRunning(false);
    setSelectedIndex(null);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setRunning(false);
  }, []);

  const startBatch = useCallback(
    async (rawInput: string | string[], config: BatchReviewConfig) => {
      const lines = splitBatchInput(rawInput);
      if (lines.length === 0) {
        return { ok: false as const, error: '未识别到有效文案，请每行一条' };
      }

      cancelledRef.current = false;
      setRunning(true);
      setSelectedIndex(null);
      setItems(createInitialBatchItems(lines));

      const concurrency = config.concurrency ?? DEFAULT_BATCH_CONCURRENCY;
      const maxRetries = config.maxRetries ?? DEFAULT_BATCH_MAX_RETRIES;

      const buildPayload = (text: string, index: number): ReviewUploadPayload => ({
        country_id: config.countryId,
        platform_id: DEMO_REVIEW_PLATFORM_ID,
        category_id: config.categoryId,
        content: { text },
        tags: ['review-app:batch', `market:${config.countryId}`, `batch-line:${index + 1}`],
      });

      await executeBatchReview({
        lines,
        concurrency,
        maxRetries,
        submit: submitReview,
        buildPayload,
        isCancelled: () => cancelledRef.current,
        callbacks: {
          onItemStart: (index) => {
            updateItem(index + 1, { status: 'running' });
          },
          onItemSuccess: (index, result, attempts) => {
            updateItem(index + 1, {
              status: 'done',
              result,
              error: undefined,
              attempts,
            });
          },
          onItemFailure: (index, error, attempts) => {
            updateItem(index + 1, {
              status: 'failed',
              error,
              attempts,
            });
          },
        },
      });

      setRunning(false);
      return { ok: true as const, count: lines.length };
    },
    [updateItem],
  );

  return {
    items,
    progress,
    running,
    selectedIndex,
    setSelectedIndex,
    startBatch,
    cancel,
    reset,
    previewLines: splitBatchInput,
  };
}
