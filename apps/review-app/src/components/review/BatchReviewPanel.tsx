import { useMemo, useState, type FormEvent } from 'react';
import type { DemoReviewCountryId, DemoSaCategoryId } from '@aairp/shared-kernel';
import { SharedReviewDimensions } from '@/components/review/SharedReviewDimensions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { useBatchReview } from '@/hooks/use-batch-review';
import { decisionBannerStyle } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Loader2, X } from 'lucide-react';
import type { BatchReviewItem } from '@/services/batch-orchestrator.service';

type BatchReviewPanelProps = {
  countryId: DemoReviewCountryId | '';
  categoryId: DemoSaCategoryId;
  onCountryChange: (value: DemoReviewCountryId) => void;
  onCategoryChange: (value: DemoSaCategoryId) => void;
  onCountryRequired?: () => void;
  countryShake?: boolean;
  batchReview: ReturnType<typeof useBatchReview>;
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function findingsCount(item: BatchReviewItem): number {
  return item.result?.summary.findings.length ?? 0;
}

function BatchDetailPanel({ item, onClose }: { item: BatchReviewItem; onClose: () => void }) {
  const decision = item.result?.final_decision;
  const banner = decision ? decisionBannerStyle(decision) : null;

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-semibold text-ink">文案 #{item.index} 详情</CardTitle>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="关闭详情">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {item.status === 'failed' && (
          <div className="rounded-md border border-red-200 bg-[#FEF2F2] px-3 py-2 text-reject">
            {item.error ?? '请求失败'}
          </div>
        )}

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">测试文案</h3>
          <p className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-ink">{item.text}</p>
        </section>

        {item.result && banner && (
          <>
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">结论</h3>
              <div className={cn('rounded-md border-l-4 px-3 py-2', banner.bar, banner.background)}>
                <span className={cn('font-semibold', banner.verdict)}>{item.result.final_decision}</span>
                <span className="ml-2 text-muted-foreground">
                  置信度 {(item.result.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{item.result.rationale}</p>
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                风险项 ({findingsCount(item)})
              </h3>
              {item.result.summary.findings.length === 0 ? (
                <p className="text-muted-foreground">无</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5">
                  {item.result.summary.findings.map((finding) => (
                    <li key={finding.finding_id}>
                      <span className="font-medium">{finding.severity}</span> · {finding.summary}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-xs text-muted-foreground">review_id: {item.result.review_id}</p>
          </>
        )}

        {item.status === 'running' && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            审查中…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function BatchReviewPanel({
  countryId,
  categoryId,
  onCountryChange,
  onCategoryChange,
  onCountryRequired,
  countryShake,
  batchReview,
}: BatchReviewPanelProps) {
  const [rawText, setRawText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { items, progress, running, selectedIndex, setSelectedIndex, startBatch, cancel, previewLines } =
    batchReview;

  const draftLines = useMemo(() => previewLines(rawText), [previewLines, rawText]);
  const selectedItem = selectedIndex !== null ? items.find((item) => item.index === selectedIndex) : null;
  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const showDraftPreview = draftLines.length > 0 && items.length === 0 && !running;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!countryId) {
      setFormError('请先选择目标市场');
      onCountryRequired?.();
      return;
    }
    setFormError(null);
    const outcome = await startBatch(rawText, { countryId, categoryId });
    if (!outcome.ok) {
      setFormError(outcome.error);
    }
  }

  return (
    <div className="grid flex-1 gap-8 lg:grid-cols-[2fr_3fr]">
      <Card className="h-fit">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-ink">批量输入</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="batch-text" className="font-medium text-ink">
                文案列表（每行一条）
              </Label>
              <Textarea
                id="batch-text"
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                rows={12}
                placeholder={'第一行文案…\n第二行文案…\n第三行文案…'}
                disabled={running}
              />
              <p className="text-xs text-muted-foreground">
                已识别 <strong>{draftLines.length}</strong> 条，提交前请核对下方预览
              </p>
            </div>

            <SharedReviewDimensions
              countryId={countryId}
              categoryId={categoryId}
              onCountryChange={onCountryChange}
              onCategoryChange={onCategoryChange}
              disabled={running}
              countryShake={countryShake}
            />

            {showDraftPreview && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">提交前核对</p>
                <ol className="max-h-40 space-y-1 overflow-y-auto text-xs text-ink">
                  {draftLines.map((line, index) => (
                    <li key={`${index}-${line.slice(0, 24)}`} className="flex gap-2">
                      <span className="shrink-0 text-muted-foreground">{index + 1}.</span>
                      <span className="min-w-0 break-words">{truncate(line, 120)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {formError && (
              <div className="rounded-md border border-red-200 bg-[#FEF2F2] px-3 py-2 text-sm text-reject">
                {formError}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" variant="brand" className="flex-1" disabled={running || !countryId}>
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    批量审查中…
                  </>
                ) : (
                  '开始批量审查'
                )}
              </Button>
              {running && (
                <Button type="button" variant="outline" onClick={cancel}>
                  取消
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {progress.total > 0 && (
          <Card>
            <CardContent className="space-y-2 pt-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  进度 {progress.completed} / {progress.total}
                  {progress.running > 0 ? ` · 运行中 ${progress.running}` : ''}
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                PASS {progress.pass} · WARN {progress.warn} · REVIEW {progress.review} · REJECT{' '}
                {progress.reject}
                {progress.failed > 0 ? ` · 失败 ${progress.failed}` : ''}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="min-h-[20rem] overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-ink">审查结果</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {items.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                粘贴多行文案并开始批量审查后，结果将显示在这里。
              </p>
            ) : (
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">文案</th>
                    <th className="px-4 py-2 font-medium">结论</th>
                    <th className="px-4 py-2 font-medium">风险</th>
                    <th className="px-4 py-2 font-medium">状态</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.index}
                      className={cn(
                        'border-b border-gray-100',
                        selectedIndex === item.index && 'bg-orange-50/50',
                      )}
                    >
                      <td className="px-4 py-2">{item.index}</td>
                      <td className="max-w-xs px-4 py-2" title={item.text}>
                        {truncate(item.text, 80)}
                      </td>
                      <td className="px-4 py-2">
                        {item.result ? (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-semibold',
                              decisionBannerStyle(item.result.final_decision).badge,
                            )}
                          >
                            {item.result.final_decision}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2">{item.result ? findingsCount(item) : '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {item.status === 'running' && (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            运行中
                          </span>
                        )}
                        {item.status === 'pending' && '等待'}
                        {item.status === 'done' && '完成'}
                        {item.status === 'failed' && '失败'}
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedIndex(item.index)}
                        >
                          详情
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {selectedItem && <BatchDetailPanel item={selectedItem} onClose={() => setSelectedIndex(null)} />}
      </div>
    </div>
  );
}
