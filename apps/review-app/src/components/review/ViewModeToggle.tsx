import type { ViewMode } from '@/hooks/use-view-mode';
import { cn } from '@/lib/utils';

type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

const OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: 'legal', label: '法务视图' },
  { value: 'business', label: '业务视图' },
];

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 bg-surface p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded px-3 py-1.5 text-xs font-medium transition-colors',
            value === option.value
              ? 'bg-ink text-white'
              : 'border border-gray-200 bg-white text-muted-foreground hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
