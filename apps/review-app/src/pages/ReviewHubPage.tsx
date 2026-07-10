import { useCallback, useEffect, useState } from 'react';
import type { DemoReviewCountryId, DemoSaCategoryId } from '@aairp/shared-kernel';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { BatchReviewPanel } from '@/components/review/BatchReviewPanel';
import { ReviewModeTabs, type ReviewMode } from '@/components/review/ReviewModeTabs';
import { SingleReviewPanel } from '@/components/review/SingleReviewPanel';
import { useBatchReview } from '@/hooks/use-batch-review';
import { useViewMode } from '@/hooks/use-view-mode';

type ReviewHubPageProps = {
  initialMode?: ReviewMode;
};

export function ReviewHubPage({ initialMode = 'single' }: ReviewHubPageProps) {
  const [viewMode, setViewMode] = useViewMode();
  const [mode, setMode] = useState<ReviewMode>(initialMode);
  const [countryId, setCountryId] = useState<DemoReviewCountryId | ''>('');
  const [categoryId, setCategoryId] = useState<DemoSaCategoryId>('sa.other');
  const [countryShake, setCountryShake] = useState(false);
  const batchReview = useBatchReview();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const triggerCountryShake = useCallback(() => {
    setCountryShake(true);
    window.setTimeout(() => setCountryShake(false), 100);
  }, []);

  function handleModeChange(next: ReviewMode) {
    if (batchReview.running) return;
    setMode(next);
    window.location.hash = next === 'batch' ? '#/batch' : '#/';
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <AppHeader viewMode={viewMode} onViewModeChange={setViewMode} />

      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <ReviewModeTabs
            mode={mode}
            onModeChange={handleModeChange}
            disabled={batchReview.running}
          />
          {mode === 'batch' && (
            <p className="text-xs text-muted-foreground">每行一条文案，将并行调用审查接口</p>
          )}
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        {mode === 'single' ? (
          <SingleReviewPanel
            viewMode={viewMode}
            countryId={countryId}
            categoryId={categoryId}
            onCountryChange={setCountryId}
            onCategoryChange={setCategoryId}
            onCountryRequired={triggerCountryShake}
            countryShake={countryShake}
          />
        ) : (
          <BatchReviewPanel
            countryId={countryId}
            categoryId={categoryId}
            onCountryChange={setCountryId}
            onCategoryChange={setCategoryId}
            onCountryRequired={triggerCountryShake}
            countryShake={countryShake}
            batchReview={batchReview}
          />
        )}
      </main>

      <AppFooter />
    </div>
  );
}
