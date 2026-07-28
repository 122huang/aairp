import { cn } from '@/lib/utils';

export type ReviewMode = 'single' | 'batch' | 'image';

type ReviewModeTabsProps = {
  mode: ReviewMode;
  onModeChange: (mode: ReviewMode) => void;
  disabled?: boolean;
  /** When false/undefined, Image tab is hidden (feature flag off). */
  showImage?: boolean;
};

export function ReviewModeTabs({
  mode,
  onModeChange,
  disabled,
  showImage = false,
}: ReviewModeTabsProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-white p-1"
      role="tablist"
      aria-label="审查模式"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'single'}
        disabled={disabled}
        className={cn(
          'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
          mode === 'single' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-ink',
          disabled && 'opacity-50',
        )}
        onClick={() => onModeChange('single')}
      >
        单条审查
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'batch'}
        disabled={disabled}
        className={cn(
          'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
          mode === 'batch' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-ink',
          disabled && 'opacity-50',
        )}
        onClick={() => onModeChange('batch')}
      >
        批量审查
      </button>
      {showImage && (
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'image'}
          disabled={disabled}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            mode === 'image' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-ink',
            disabled && 'opacity-50',
          )}
          onClick={() => onModeChange('image')}
        >
          图片审查
        </button>
      )}
    </div>
  );
}
