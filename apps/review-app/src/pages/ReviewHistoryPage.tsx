import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DEMO_REVIEW_COUNTRIES, type DemoReviewCountryId } from '@aairp/shared-kernel';
import { searchCases, type CaseManifestDto, type CasesApiError } from '@/api/cases';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { hrefForRoute } from '@/lib/hash-route';
import { decisionBannerStyle } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Loader2, Search } from 'lucide-react';

const DECISIONS = ['PASS', 'WARN', 'REVIEW', 'REJECT'] as const;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

function toCreatedFrom(dateLocal: string): string | undefined {
  if (!dateLocal) return undefined;
  return new Date(`${dateLocal}T00:00:00`).toISOString();
}

function toCreatedTo(dateLocal: string): string | undefined {
  if (!dateLocal) return undefined;
  return new Date(`${dateLocal}T23:59:59.999`).toISOString();
}

export function ReviewHistoryPage() {
  const [caseId, setCaseId] = useState('');
  const [threadId, setThreadId] = useState('');
  const [countryId, setCountryId] = useState<DemoReviewCountryId | ''>('');
  const [decision, setDecision] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseManifestDto[]>([]);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await searchCases({
        ...(caseId.trim() ? { case_id: caseId.trim() } : {}),
        ...(threadId.trim() ? { thread_id: threadId.trim() } : {}),
        ...(countryId ? { country_id: countryId } : {}),
        ...(decision ? { final_decision: decision } : {}),
        ...(dateFrom ? { created_from: toCreatedFrom(dateFrom) } : {}),
        ...(dateTo ? { created_to: toCreatedTo(dateTo) } : {}),
        limit: 50,
        offset: 0,
      });
      setCases(response.cases);
    } catch (caught) {
      const apiError = caught as CasesApiError;
      setError(apiError.message ?? '加载失败');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [caseId, threadId, countryId, decision, dateFrom, dateTo]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void runSearch();
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h2 className="text-lg font-semibold text-ink">审核记录</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            按 case_id / thread_id / 国家 / 决策 / 提交时间查找历史案例，打开后可继续重新提交。
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-ink">筛选</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="filter-case-id">case_id（精确）</Label>
                <input
                  id="filter-case-id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  placeholder="完整 case_id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-thread-id">thread_id（精确）</Label>
                <input
                  id="filter-thread-id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={threadId}
                  onChange={(e) => setThreadId(e.target.value)}
                  placeholder="有则填写"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-country">国家</Label>
                <select
                  id="filter-country"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value as DemoReviewCountryId | '')}
                >
                  <option value="">全部</option>
                  {DEMO_REVIEW_COUNTRIES.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.id} · {country.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-decision">决策结果</Label>
                <select
                  id="filter-decision"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                >
                  <option value="">全部</option>
                  {DECISIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-from">提交时间起</Label>
                <input
                  id="filter-from"
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-to">提交时间止</Label>
                <input
                  id="filter-to"
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="flex items-end md:col-span-2 lg:col-span-3">
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  查询
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-ink">
              结果 {loading ? '' : `（${cases.length}）`}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {error && (
              <div className="mx-6 mb-4 rounded-md border border-red-200 bg-[#FEF2F2] px-3 py-2 text-sm text-reject">
                {error}
              </div>
            )}
            {loading ? (
              <p className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中…
              </p>
            ) : cases.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                没有匹配的审核记录。请调整筛选条件，或先在单条审查中提交案例。
              </p>
            ) : (
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">提交时间</th>
                    <th className="px-4 py-2 font-medium">国家</th>
                    <th className="px-4 py-2 font-medium">决策</th>
                    <th className="px-4 py-2 font-medium">文案摘要</th>
                    <th className="px-4 py-2 font-medium">case_id</th>
                    <th className="px-4 py-2 font-medium">thread_id</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((item) => (
                    <tr key={`${item.case_id}-${item.case_version}`} className="border-b border-gray-100">
                      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                        {formatTime(item.created_at)}
                      </td>
                      <td className="px-4 py-2">{item.country_id}</td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            decisionBannerStyle(item.final_decision).badge,
                          )}
                        >
                          {item.final_decision}
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-2" title={item.text_preview}>
                        {item.text_preview || '—'}
                      </td>
                      <td className="max-w-[10rem] truncate px-4 py-2 font-mono text-xs" title={item.case_id}>
                        {item.case_id}
                      </td>
                      <td
                        className="max-w-[10rem] truncate px-4 py-2 font-mono text-xs text-muted-foreground"
                        title={item.thread_id}
                      >
                        {item.thread_id || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Button type="button" variant="ghost" size="sm" asChild>
                          <a href={hrefForRoute({ name: 'case', caseId: item.case_id })}>打开</a>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
