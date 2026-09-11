import { useState } from 'react';
import type { ClaimOpinion, ClaimOpinionKind } from '@aairp/shared-kernel';
import { ChevronDown } from 'lucide-react';
import { briefHitPath } from '@/lib/review-result-view';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const KIND_BADGE: Record<ClaimOpinionKind, string> = {
  prohibited: 'bg-red-100 text-red-900',
  needs_substantiation: 'bg-amber-100 text-amber-950',
  substantiation_weak: 'bg-amber-100 text-amber-950',
  substantiation_supports: 'bg-emerald-100 text-emerald-900',
  copy_only: 'bg-gray-100 text-gray-700',
  unused_evidence: 'bg-gray-100 text-gray-700',
  evidence_not_evaluated: 'bg-gray-100 text-gray-700',
};

type ClaimOpinionListProps = {
  opinions: ClaimOpinion[];
  mode: 'copy' | 'evidence';
  emptyText?: string;
};

function OpinionCard({
  opinion,
  mode,
  defaultOpen,
}: {
  opinion: ClaimOpinion;
  mode: 'copy' | 'evidence';
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const evidence = opinion.evidence ?? [];
  const hitPath = briefHitPath(opinion);
  const quote = opinion.quote || opinion.claim_anchor;

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-ink">{quote}</p>
        <span
          className={cn(
            'shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold',
            KIND_BADGE[opinion.kind],
          )}
        >
          {opinion.label}
        </span>
      </div>

      {hitPath && mode === 'copy' && (
        <p className="mt-1.5 text-xs text-muted-foreground">命中：{hitPath}</p>
      )}

      <p className="mt-2 text-sm leading-relaxed text-ink/80">{opinion.summary}</p>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-ink">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          {mode === 'copy' ? '查看原文' : '查看材料摘录'}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 border-t border-gray-200/80 pt-2">
          {mode === 'copy' ? (
            <div className="rounded-md border border-amber-200/80 bg-amber-50/50 p-2.5">
              <p className="text-xs leading-relaxed text-ink">{quote || '（无定位片段）'}</p>
            </div>
          ) : evidence.length === 0 ? (
            <p className="text-xs leading-relaxed text-ink/70">
              {opinion.kind === 'needs_substantiation'
                ? '本次未提交支撑材料。'
                : opinion.kind === 'evidence_not_evaluated'
                  ? '本次未进入相关性及充分性判断。'
                  : '本次未纳入材料判断。'}
            </p>
          ) : (
            <div className="space-y-2">
              {evidence.map((item) => (
                <div
                  key={item.evidence_id}
                  className="rounded-md border border-blue-200/80 bg-blue-50/50 p-2.5"
                >
                  <p className="text-xs font-medium text-ink">
                    {item.title}
                    <span className="ml-1 font-normal text-gray-500">（{item.filename}）</span>
                  </p>
                  {item.text_unreadable && (
                    <p className="mt-1 text-xs text-rose-800">
                      文件无法提取可读文本，未用于降低风险。
                    </p>
                  )}
                  <p className="mt-1 text-xs leading-relaxed text-ink">
                    {item.excerpt?.trim() || '（未提取到对应内容）'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}

export function ClaimOpinionList({ opinions, mode, emptyText }: ClaimOpinionListProps) {
  if (opinions.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        {emptyText ?? '本栏暂无明细。'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {opinions.map((opinion, index) => (
        <OpinionCard
          key={`${mode}:${opinion.kind}:${opinion.claim_anchor}:${opinion.finding_ids.join('|')}:${index}`}
          opinion={opinion}
          mode={mode}
          defaultOpen={false}
        />
      ))}
    </div>
  );
}
