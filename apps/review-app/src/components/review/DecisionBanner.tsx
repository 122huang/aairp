import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ViewMode } from '@/hooks/use-view-mode';
import { businessDecisionLabel, legalDecisionBannerText } from '@/lib/business-copy';
import { decisionBannerStyle } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type DecisionBannerProps = {
  viewMode: ViewMode;
  decision: string;
  confidence: number;
  rationale: string;
  refIds: string[];
  findingsCount: number;
};

export function DecisionBanner({
  viewMode,
  decision,
  confidence,
  rationale,
  refIds,
  findingsCount,
}: DecisionBannerProps) {
  const [open, setOpen] = useState(false);
  const style = decisionBannerStyle(decision);
  const hasDetails = rationale.trim().length > 0 || refIds.length > 0;
  const isLegal = viewMode === 'legal';

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 border-l-4 px-5 py-4',
        style.bar,
        style.background,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('text-xl font-semibold', style.verdict)}>
          {isLegal ? decision : businessDecisionLabel(decision)}
        </span>
        {isLegal && (
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', style.badge)}>
            Confidence {(confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {isLegal && (
        <p className="mt-2 text-sm leading-relaxed text-ink/80">
          {legalDecisionBannerText(decision, findingsCount)}
        </p>
      )}

      {isLegal && hasDetails && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-ink">
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            查看详情
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 border-t border-gray-200/80 pt-2">
            {rationale.trim().length > 0 && (
              <p className="text-sm leading-relaxed text-ink/70">{rationale}</p>
            )}
            {refIds.length > 0 && (
              <ul className="space-y-1 font-mono text-xs text-ink/70">
                {refIds.map((refId) => (
                  <li key={refId}>{refId}</li>
                ))}
              </ul>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
