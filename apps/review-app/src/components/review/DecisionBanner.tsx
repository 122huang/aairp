import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ReviewResultHelp } from '@/components/review/ReviewResultHelp';
import { legalDecisionBannerText } from '@/lib/legal-copy';
import { decisionBannerStyle } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type DecisionBannerProps = {
  decision: string;
  confidence: number;
  rationale: string;
  refIds: string[];
  findingsCount: number;
};

export function DecisionBanner({
  decision,
  confidence,
  rationale,
  refIds,
  findingsCount,
}: DecisionBannerProps) {
  const [open, setOpen] = useState(false);
  const style = decisionBannerStyle(decision);
  const hasDetails = rationale.trim().length > 0 || refIds.length > 0;

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 border-l-4 px-5 py-4',
        style.bar,
        style.background,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('text-xl font-semibold', style.verdict)}>{decision}</span>
        <span
          className={cn('rounded-md px-2 py-0.5 text-xs font-medium', style.badge)}
          title="决策档位基准值：由最终决策档（PASS/WARN/REVIEW/REJECT）映射的固定基准，不是针对本条文案的模型把握度；与 finding 来自 RULE 还是 LLM 无关。"
        >
          决策档位基准 {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      <ReviewResultHelp className="mt-2" />

      <p className="mt-2 text-sm leading-relaxed text-ink/80">
        {legalDecisionBannerText(decision, findingsCount)}
      </p>

      {hasDetails && (
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
