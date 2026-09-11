import { legalDecisionBannerText } from '@/lib/legal-copy';
import { decisionBannerStyle } from '@/lib/review-ui';
import { decisionLabelZh } from '@/lib/review-result-view';
import { cn } from '@/lib/utils';

type OverallDecisionBannerProps = {
  decision: string;
  findingsCount: number;
  evidenceCleared?: boolean;
};

export function OverallDecisionBanner({
  decision,
  findingsCount,
  evidenceCleared,
}: OverallDecisionBannerProps) {
  const style = decisionBannerStyle(decision);

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 border-l-4 px-6 py-5',
        style.bar,
        style.background,
      )}
    >
      <p className="text-sm font-medium text-ink/70">综合审核结果</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <span className={cn('text-3xl font-bold tracking-tight', style.verdict)}>
          {decisionLabelZh(decision)}
        </span>
        <span className={cn('text-sm font-medium uppercase', style.verdict)}>{decision}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink/80">
        {legalDecisionBannerText(decision, findingsCount, { evidenceCleared })}
      </p>
    </div>
  );
}
