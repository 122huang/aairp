import { useCallback, useEffect, useState } from 'react';
import type { DemoReviewCountryId, DemoSaCategoryId } from '@aairp/shared-kernel';
import { fetchRuntimeModes } from '@/api/evidence';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { BatchReviewPanel } from '@/components/review/BatchReviewPanel';
import { ImageReviewPanel } from '@/components/review/ImageReviewPanel';
import { ReviewModeTabs, type ReviewMode } from '@/components/review/ReviewModeTabs';
import { SingleReviewPanel } from '@/components/review/SingleReviewPanel';
import { useBatchReview } from '@/hooks/use-batch-review';
import { hashForReviewMode } from '@/lib/hash-route';

type ReviewHubPageProps = {
  initialMode?: ReviewMode;
  /** When set (from `#/?parent_case_id=`), single review restores that case for resubmit. */
  initialParentCaseId?: string;
};

export function ReviewHubPage({
  initialMode = 'single',
  initialParentCaseId,
}: ReviewHubPageProps) {
  const [mode, setMode] = useState<ReviewMode>(initialMode);
  const [countryId, setCountryId] = useState<DemoReviewCountryId | ''>('');
  const [categoryId, setCategoryId] = useState<DemoSaCategoryId>('sa.other');
  const [countryShake, setCountryShake] = useState(false);
  const [imageReviewEnabled, setImageReviewEnabled] = useState(false);
  const batchReview = useBatchReview();

  useEffect(() => {
    let cancelled = false;
    void fetchRuntimeModes()
      .then((modes) => {
        if (cancelled) return;
        setImageReviewEnabled(modes.image_review_entry === 'on');
      })
      .catch(() => {
        if (!cancelled) setImageReviewEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialMode === 'image' && !imageReviewEnabled) {
      setMode('single');
      return;
    }
    setMode(initialMode);
  }, [initialMode, imageReviewEnabled]);

  const triggerCountryShake = useCallback(() => {
    setCountryShake(true);
    window.setTimeout(() => setCountryShake(false), 100);
  }, []);

  function handleModeChange(next: ReviewMode) {
    if (batchReview.running) return;
    if (next === 'image' && !imageReviewEnabled) return;
    setMode(next);
    window.location.hash = hashForReviewMode(next);
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <AppHeader />

      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <ReviewModeTabs
            mode={mode}
            onModeChange={handleModeChange}
            disabled={batchReview.running}
            showImage={imageReviewEnabled}
          />
          {mode === 'batch' && (
            <p className="text-xs text-muted-foreground">每行一条文案，将并行调用审查接口</p>
          )}
          {mode === 'image' && (
            <p className="text-xs text-muted-foreground">识别 → 核对文本 → 开始审查（单张长图）</p>
          )}
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        {mode === 'single' ? (
          <SingleReviewPanel
            countryId={countryId}
            categoryId={categoryId}
            onCountryChange={setCountryId}
            onCategoryChange={setCategoryId}
            onCountryRequired={triggerCountryShake}
            countryShake={countryShake}
            initialParentCaseId={initialParentCaseId}
            showImageReviewHint={imageReviewEnabled}
          />
        ) : mode === 'batch' ? (
          <BatchReviewPanel
            countryId={countryId}
            categoryId={categoryId}
            onCountryChange={setCountryId}
            onCategoryChange={setCategoryId}
            onCountryRequired={triggerCountryShake}
            countryShake={countryShake}
            batchReview={batchReview}
          />
        ) : (
          <ImageReviewPanel
            countryId={countryId}
            categoryId={categoryId}
            onCountryChange={setCountryId}
            onCategoryChange={setCategoryId}
            onCountryRequired={triggerCountryShake}
            countryShake={countryShake}
          />
        )}
      </main>

      <AppFooter />
    </div>
  );
}
