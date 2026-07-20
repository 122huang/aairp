import { useEffect, useMemo, useState } from 'react';
import { fetchCase, type CasesApiError } from '@/api/cases';
import { openCaseReport } from '@/api/case-report';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { DecisionBanner } from '@/components/review/DecisionBanner';
import { FindingsList } from '@/components/review/FindingsList';
import { SourceMaterial } from '@/components/review/SourceMaterial';
import { Button } from '@/components/ui/button';
import { caseRecordToDemoReviewResponse } from '@/lib/case-to-review-result';
import { extractEvidenceSpans, mergeFindingsByRiskType } from '@/lib/finding-merge';
import { hrefForRoute } from '@/lib/hash-route';
import { collectHighlightSpans, severityRank } from '@/lib/review-ui';
import { ArrowLeft, Loader2 } from 'lucide-react';

type CaseDetailPageProps = {
  caseId: string;
};

export function CaseDetailPage({ caseId }: CaseDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof caseRecordToDemoReviewResponse> | null>(
    null,
  );
  const [adText, setAdText] = useState('');
  const [disclaimerText, setDisclaimerText] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchCase(caseId)
      .then((record) => {
        if (cancelled) return;
        setResult(caseRecordToDemoReviewResponse(record));
        setAdText(record.advertisement.content.text ?? '');
        setDisclaimerText(record.advertisement.content.disclaimer_text ?? '');
        setImagePreviews(record.advertisement.content.image_urls ?? []);
      })
      .catch((caught) => {
        if (cancelled) return;
        const apiError = caught as CasesApiError;
        setError(apiError.message ?? '加载失败');
        setResult(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const mergedFindings = useMemo(() => {
    if (!result) return [];
    const sorted = [...result.summary.findings].sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity),
    );
    return mergeFindingsByRiskType(sorted);
  }, [result]);

  const refIds = useMemo(() => {
    if (!result) return [];
    return [...new Set(result.summary.findings.map((f) => f.ref_id))];
  }, [result]);

  const highlightSpans = useMemo(() => {
    if (!result) return [];
    const spans = result.summary.findings.flatMap(extractEvidenceSpans);
    return collectHighlightSpans(adText, spans);
  }, [result, adText]);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href={hrefForRoute({ name: 'history' })}>
                <ArrowLeft className="h-4 w-4" />
                返回审核记录
              </a>
            </Button>
            <h2 className="mt-2 text-lg font-semibold text-ink">案例详情（只读）</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{caseId}</p>
          </div>
          {result && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => openCaseReport(caseId, 'business_handoff')}
              >
                导出业务提醒摘要
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => openCaseReport(caseId, 'legal_audit')}
              >
                导出完整审核报告
              </Button>
              <Button type="button" variant="brand" asChild>
                <a href={hrefForRoute({ name: 'single', parentCaseId: caseId })}>
                  基于此案例修改后重新提交
                </a>
              </Button>
            </div>
          )}
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载案例…
          </p>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-[#FEF2F2] px-3 py-2 text-sm text-reject">
            {error}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-5">
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>review_id: {result.review_id}</span>
                {result.thread_id && <span>thread_id: {result.thread_id}</span>}
                {result.parent_case_id && <span>parent_case_id: {result.parent_case_id}</span>}
                <span>
                  {result.summary.advertisement.country_id} · {result.summary.advertisement.category_id}
                </span>
              </div>
            </div>

            <DecisionBanner
              decision={result.final_decision}
              rationale={result.rationale}
              refIds={refIds}
              findingsCount={mergedFindings.length}
            />

            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink">
                审查发现 ({mergedFindings.length})
              </h3>
              <FindingsList findings={mergedFindings} />
            </section>

            <SourceMaterial
              text={adText}
              disclaimerText={disclaimerText}
              highlightSpans={highlightSpans}
              imagePreviews={imagePreviews}
            />
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
