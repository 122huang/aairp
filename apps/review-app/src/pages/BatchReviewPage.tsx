import { useMemo, useState, type FormEvent } from 'react';
import {
  DEMO_REVIEW_COUNTRIES,
  DEMO_SA_CATEGORIES,
  type DemoReviewCountryId,
  type DemoSaCategoryId,
} from '@aairp/shared-kernel';
import { AppFooter } from '@/components/layout/AppFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useBatchReview } from '@/hooks/use-batch-review';
import { decisionBannerStyle } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Loader2, X } from 'lucide-react';
import type { BatchReviewItem } from '@/services/batch-orchestrator.service';

const VISIBLE_COUNTRY_IDS = ['SG', 'MY', 'TH'] as const satisfies readonly DemoReviewCountryId[];
const VISIBLE_COUNTRIES = DEMO_REVIEW_COUNTRIES.filter((country) =>
  (VISIBLE_COUNTRY_IDS as readonly string[]).includes(country.id),
);

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

export function BatchReviewPage() {
  const [rawText, setRawText] = useState('');
  const [countryId, setCountryId] = useState<DemoReviewCountryId | ''>('');
  const [categoryId, setCategoryId] = useState<DemoSaCategoryId>('sa.other');
  const [formError, setFormError] = useState<string | null>(null);

  const { items, progress, running, selectedIndex, setSelectedIndex, startBatch, cancel, previewLines } =
    useBatchReview();

  const previewCount = useMemo(() => previewLines(rawText).length, [previewLines, rawText]);
  const selectedItem = selectedIndex !== null ? items.find((item) => item.index === selectedIndex) : null;
  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!countryId) {
      setFormError('请先选择目标市场');
      return;
    }
    setFormError(null);
    const outcome = await startBatch(rawText, { countryId, categoryId });
    if (!outcome.ok) {
      setFormError(outcome.error);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-[10px] font-bold text-white"
              aria-hidden
            >
              ACH
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight text-ink">Ad Compliance Hub</h1>
              <p className="text-[9.6px] leading-tight text-muted-foreground">批量试用 · 内部</p>
            </div>
          </div>
          <a href="#/" className="text-sm text-muted-foreground hover:text-ink">
            返回单条审查
          </a>
        </div>
      </header>

      <p className="border-b border-blue-100 bg-blue-50 px-6 py-2 text-xs text-blue-800">
        每行一条文案，系统将并行调用审查接口（仅前端编排，不修改后端）。
      </p>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 py-8 lg:grid-cols-[2fr_3fr]">
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
                  placeholder={'Line one…\nLine two…\nLine three…'}
                  disabled={running}
                />
                <p className="text-xs text-muted-foreground">
                  已识别 <strong>{previewCount}</strong> 条
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-medium text-ink">
                    国家 <span className="text-reject">*</span>
                  </Label>
                  <Select
                    value={countryId || undefined}
                    onValueChange={(value) => setCountryId(value as DemoReviewCountryId)}
                    disabled={running}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBLE_COUNTRIES.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.id} · {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium text-ink">品类</Label>
                  <Select
                    value={categoryId}
                    onValueChange={(value) => setCategoryId(value as DemoSaCategoryId)}
                    disabled={running}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_SA_CATEGORIES.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                  PASS {progress.pass} · WARN {progress.warn} · REJECT {progress.reject}
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
                  粘贴文案并开始批量审查后，结果将显示在这里。
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

          {selectedItem && (
            <BatchDetailPanel item={selectedItem} onClose={() => setSelectedIndex(null)} />
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
