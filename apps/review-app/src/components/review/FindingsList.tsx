import { useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import type { MergedFinding, MergedFindingItem } from '@/lib/finding-merge';
import { resolveLegalSummaryZh } from '@/lib/legal-copy';
import { findingDecisionBadgeClass, severityBadgeClass, shouldExpandByDefault } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function triggerSnippet(item: MergedFindingItem): string | null {
  const span = item.evidenceSpans[0]?.text;
  return span?.trim() || null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleCopy} className="shrink-0 text-ink/70">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '已复制' : '复制'}
    </Button>
  );
}

function ModuleBadges({ modules }: { modules: string[] }) {
  return (
    <>
      {modules.map((module) => (
        <span
          key={module}
          className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-ink"
        >
          {module}
        </span>
      ))}
    </>
  );
}

function RewriteSuggestions({
  item,
}: {
  item: Pick<MergedFindingItem, 'decision' | 'severity' | 'rewriteSuggestions'>;
}) {
  const rewrites = item.rewriteSuggestions;
  const showRewrites = item.decision === 'WARN' && rewrites.length > 0;
  const [open, setOpen] = useState(shouldExpandByDefault(item.severity));

  if (!showRewrites) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ink">
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        改写建议 ({rewrites.reduce((n, r) => n + r.suggested_text.length, 0)})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {rewrites.flatMap((rewrite) =>
          rewrite.suggested_text.map((suggestion, index) => (
            <div
              key={`${rewrite.suggestion_id}-${index}`}
              className="flex items-start justify-between gap-3 rounded-md border-l-2 border-l-pass bg-rewrite px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-ink">{suggestion}</p>
                <p className="mt-1 text-xs text-gray-400">{rewrite.rationale}</p>
              </div>
              <CopyButton text={suggestion} />
            </div>
          )),
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FindingSubItem({ item }: { item: MergedFindingItem }) {
  const legalSummaryZh = resolveLegalSummaryZh(item);
  const trigger = triggerSnippet(item);

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start gap-2">
        <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-ink">
          {item.riskType}
        </span>
        <ModuleBadges modules={item.modules} />
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-xs font-medium',
            findingDecisionBadgeClass(item.decision),
          )}
          title="decision：现在要不要拦 / 要不要人工处理（与 severity 独立）"
        >
          {item.decision}
        </span>
        <span
          className={cn('rounded-md px-2 py-0.5 text-xs font-medium', severityBadgeClass(item.severity))}
          title="severity：若问题属实的法律/合规严重程度（与 decision 独立）"
        >
          {item.severity}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-ink">{legalSummaryZh}</p>
          <p className="mt-0.5 text-xs text-gray-400">{item.summary}</p>
        </div>
      </div>

      {trigger && (
        <div className="font-mono text-xs">
          <span className="rounded bg-highlight px-1.5 py-0.5 text-ink">{trigger}</span>
        </div>
      )}

      <RewriteSuggestions item={item} />
    </div>
  );
}

function ClaimAnchorCard({ finding }: { finding: MergedFinding }) {
  const isGrouped = finding.items.length > 1;
  const primary = finding.items[0]!;
  if (!isGrouped) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <FindingSubItem item={primary} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">原文片段</p>
        <p className="font-mono text-sm leading-relaxed text-ink">
          <span className="rounded bg-highlight px-1.5 py-0.5">{finding.claimAnchor}</span>
        </p>
        <p className="text-xs text-gray-400">
          {finding.riskTypes.length} 类风险 · {finding.modules.join(' / ')}
        </p>
      </div>
      <div className="space-y-3">
        {finding.items.map((item) => (
          <FindingSubItem key={`${item.riskType}:${item.findingIds.join('|')}`} item={item} />
        ))}
      </div>
    </div>
  );
}

type FindingsListProps = {
  findings: MergedFinding[];
};

export function FindingsList({ findings }: FindingsListProps) {
  if (findings.length === 0) {
    return <p className="text-sm text-muted-foreground">未发现风险项</p>;
  }

  return (
    <div className="space-y-3">
      {findings.map((finding) => (
        <ClaimAnchorCard
          key={finding.findingIds.join('|') || finding.groupKey}
          finding={finding}
        />
      ))}
    </div>
  );
}
