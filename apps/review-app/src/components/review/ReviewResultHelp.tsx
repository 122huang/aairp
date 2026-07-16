import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { DECISION_TIER_HELP, SEVERITY_VS_DECISION_HELP } from '@/lib/legal-copy';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type HelpBlock = {
  title: string;
  body: string;
};

function HelpPanel({ block, className }: { block: HelpBlock; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger
        type="button"
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground',
          'hover:bg-white/60 hover:text-ink',
        )}
        title={block.title}
        aria-label={block.title}
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{block.title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 max-w-xl rounded-md border border-gray-200/80 bg-white/80 px-3 py-2 text-xs leading-relaxed text-ink/75 whitespace-pre-line">
        {block.body}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** 挂在审核结果旁的常驻说明（决策档位 + severity/decision 双维度） */
export function ReviewResultHelp({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start gap-x-3 gap-y-1', className)}>
      <HelpPanel block={DECISION_TIER_HELP} />
      <HelpPanel block={SEVERITY_VS_DECISION_HELP} />
    </div>
  );
}
