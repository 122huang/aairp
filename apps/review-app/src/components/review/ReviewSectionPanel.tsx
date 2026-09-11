import type { ReactNode } from 'react';
import type { ReviewSectionStatus } from '@/lib/review-result-view';
import { decisionBannerStyle } from '@/lib/review-ui';
import { cn } from '@/lib/utils';

type ReviewSectionPanelProps = {
  title: string;
  status: ReviewSectionStatus;
  children: ReactNode;
};

export function ReviewSectionPanel({ title, status, children }: ReviewSectionPanelProps) {
  const neutral = status.decision === 'NONE' || status.decision === 'NOT_EVALUATED';
  const style = neutral ? decisionBannerStyle('PASS') : decisionBannerStyle(status.decision);

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <span
            className={cn(
              'rounded-md px-3 py-1 text-sm font-semibold',
              neutral ? 'bg-gray-100 text-gray-700' : style.badge,
            )}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink/75">{status.summary}</p>
      </div>
      <div className="space-y-3 px-5 py-4">{children}</div>
    </section>
  );
}
