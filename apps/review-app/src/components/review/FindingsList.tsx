import { useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import type { ViewMode } from '@/hooks/use-view-mode';
import type { MergedFinding } from '@/lib/finding-merge';
import { businessSeverityStyle, resolveBusinessSummary, resolveLegalSummaryZh } from '@/lib/business-copy';
import { severityBadgeClass, shouldExpandByDefault } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function triggerSnippet(finding: MergedFinding): string | null {
  const span = finding.evidenceSpans[0]?.text;
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

function FindingItem({ finding, viewMode }: { finding: MergedFinding; viewMode: ViewMode }) {
  const [open, setOpen] = useState(shouldExpandByDefault(finding.severity));
  const rewrites = finding.rewriteSuggestions;
  const showRewrites = finding.decision === 'WARN' && rewrites.length > 0;
  const trigger = triggerSnippet(finding);
  const isLegal = viewMode === 'legal';
  const severity = isLegal
    ? { label: finding.severity, className: severityBadgeClass(finding.severity) }
    : businessSeverityStyle(finding.severity);
  const businessSummary = resolveBusinessSummary(finding);
  const legalSummaryZh = resolveLegalSummaryZh(finding);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-2">
          {isLegal && (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-ink">
              {finding.riskType}
            </span>
          )}
          {isLegal && <ModuleBadges modules={finding.modules} />}
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', severity.className)}>
            {severity.label}
          </span>
          {isLegal ? (
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-ink">{legalSummaryZh}</p>
              <p className="mt-0.5 text-xs text-gray-400">{finding.summary}</p>
            </div>
          ) : (
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink">{businessSummary}</p>
          )}
        </div>

        {trigger && (
          <div className={cn(isLegal && 'font-mono text-xs')}>
            <span className="rounded bg-highlight px-1.5 py-0.5 text-ink">{trigger}</span>
          </div>
        )}

        {showRewrites && (
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
                      {isLegal && (
                        <p className="mt-1 text-xs text-gray-400">{rewrite.rationale}</p>
                      )}
                    </div>
                    <CopyButton text={suggestion} />
                  </div>
                )),
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

type FindingsListProps = {
  viewMode: ViewMode;
  findings: MergedFinding[];
};

export function FindingsList({ viewMode, findings }: FindingsListProps) {
  if (findings.length === 0) {
    return <p className="text-sm text-muted-foreground">未发现风险项</p>;
  }

  return (
    <div className="space-y-3">
      {findings.map((finding) => (
        <FindingItem key={finding.riskType} finding={finding} viewMode={viewMode} />
      ))}
    </div>
  );
}
