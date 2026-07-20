import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  DEMO_REVIEW_PLATFORM_ID,
  type DemoReviewCountryId,
  type DemoSaCategoryId,
} from '@aairp/shared-kernel';
import { submitReview, type DemoReviewResponse, type ReviewApiError } from '@/api/review';
import { openCaseReport } from '@/api/case-report';
import { SharedReviewDimensions } from '@/components/review/SharedReviewDimensions';
import { DecisionBanner } from '@/components/review/DecisionBanner';
import { FindingsList } from '@/components/review/FindingsList';
import { FindingEvidencePanel } from '@/components/review/FindingEvidencePanel';
import { SourceMaterial } from '@/components/review/SourceMaterial';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AD_TYPE_OPTIONS, type AdTypeValue } from '@/lib/ad-type-copy';
import { mergeFindingsByRiskType, extractEvidenceSpans } from '@/lib/finding-merge';
import { collectHighlightSpans, filesToBase64, severityRank } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Loader2, Upload, X } from 'lucide-react';

type SingleReviewPanelProps = {
  countryId: DemoReviewCountryId | '';
  categoryId: DemoSaCategoryId;
  onCountryChange: (value: DemoReviewCountryId) => void;
  onCategoryChange: (value: DemoSaCategoryId) => void;
  onCountryRequired?: () => void;
  countryShake?: boolean;
};

export function SingleReviewPanel({
  countryId,
  categoryId,
  onCountryChange,
  onCategoryChange,
  onCountryRequired,
  countryShake,
}: SingleReviewPanelProps) {
  const [text, setText] = useState('');
  const [adType, setAdType] = useState<AdTypeValue>('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoReviewResponse | null>(null);
  /** Next submit joins this parent case's thread (set only via explicit resubmit button). */
  const [pendingParentCaseId, setPendingParentCaseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

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
    return collectHighlightSpans(text, spans);
  }, [result, text]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
    event.target.value = '';
  }

  function clearImages() {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImageFiles([]);
    setImagePreviews([]);
  }

  function handleResubmitFromCase() {
    if (!result?.case_id) return;
    setPendingParentCaseId(result.case_id);
    setResult(null);
    setError(null);
    window.requestAnimationFrame(() => {
      textAreaRef.current?.focus();
      textAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && imageFiles.length === 0) {
      setError('请输入广告文案或上传至少一张图片');
      return;
    }

    if (!countryId) {
      setError('请先选择目标市场');
      onCountryRequired?.();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { imageDataUrls } = await filesToBase64(imageFiles);
      const response = await submitReview({
        country_id: countryId,
        platform_id: DEMO_REVIEW_PLATFORM_ID,
        category_id: categoryId,
        content: {
          text: trimmed,
          ...(imageDataUrls.length > 0 ? { images: imageDataUrls } : {}),
        },
        ...(adType ? { context: { ad_type: adType } } : {}),
        tags: ['review-app:6u-1', `market:${countryId}`],
        ...(pendingParentCaseId ? { parent_case_id: pendingParentCaseId } : {}),
      });
      setPendingParentCaseId(null);
      setResult(response);
    } catch (caught) {
      const apiError = caught as ReviewApiError;
      setError(apiError.message ?? '提交失败，请稍后重试');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const findingsCount = mergedFindings.length;
  const countrySelected = countryId !== '';
  const canSubmit = countrySelected && !loading;

  return (
    <div className="grid flex-1 gap-8 lg:grid-cols-[2fr_3fr]">
      <Card className="h-fit">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-ink">审查内容</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {pendingParentCaseId && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                将基于上一案例重新提交（线程关联已就绪）。修改文案后点击审核即可。
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="ad-text" className="font-medium text-ink">
                文案内容
              </Label>
              <Textarea
                id="ad-text"
                ref={textAreaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="粘贴广告文案，支持中英文混排…"
              />
            </div>

            <SharedReviewDimensions
              countryId={countryId}
              categoryId={categoryId}
              onCountryChange={onCountryChange}
              onCategoryChange={onCategoryChange}
              disabled={loading}
              countryShake={countryShake}
            />

            <div className="space-y-2">
              <Label htmlFor="ad-type" className="font-medium text-ink">
                内容类型
              </Label>
              <select
                id="ad-type"
                className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={adType}
                disabled={loading}
                onChange={(event) => setAdType(event.target.value as AdTypeValue)}
              >
                {AD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'unlabeled'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-ink">图片（可选）</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageChange}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  上传图片
                </Button>
                {imageFiles.length > 0 && (
                  <Button type="button" variant="ghost" onClick={clearImages}>
                    <X className="h-4 w-4" />
                    清除 {imageFiles.length} 张
                  </Button>
                )}
              </div>
              {imagePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {imagePreviews.map((src, index) => (
                    <img
                      key={src}
                      src={src}
                      alt={`预览 ${index + 1}`}
                      className="h-20 w-20 rounded-md border border-gray-200 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-[#FEF2F2] px-3 py-2 text-sm text-reject">
                {error}
              </div>
            )}

            <div
              onClick={() => {
                if (!countrySelected && !loading) {
                  onCountryRequired?.();
                }
              }}
            >
              <Button
                type="submit"
                variant="brand"
                className={cn('w-full', !canSubmit && 'pointer-events-none')}
                disabled={!canSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    审查中…
                  </>
                ) : (
                  '提交审查'
                )}
              </Button>
            </div>
            {!countrySelected && (
              <p className="text-center text-xs text-reject">⚠ 请先选择目标市场后提交</p>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col space-y-5">
        {!result && !loading && (
          <div className="flex min-h-[28rem] flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-10">
            <div className="mx-auto max-w-sm text-center">
              <p className="text-sm font-semibold text-ink">审查结果将显示在这里</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                输入广告文案并选择目标市场后提交，系统将返回投放建议、风险项明细与改写建议。
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在运行合规审查管线…
          </div>
        )}

        {result && !loading && (
          <>
            <DecisionBanner
              decision={result.final_decision}
              rationale={result.rationale}
              refIds={refIds}
              findingsCount={findingsCount}
            />

            {result.case_id && (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => openCaseReport(result.case_id!, 'business_handoff')}
                  >
                    导出业务提醒摘要
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => openCaseReport(result.case_id!, 'legal_audit')}
                  >
                    导出完整审核报告
                  </Button>
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleResubmitFromCase}>
                    基于此案例修改后重新提交
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  业务提醒摘要仅在 PASS/WARN，或 REVIEW 且全部 REVIEW
                  finding 已完成证据确认时可导出；完整审核报告始终可导出。重新提交将关联到同一审查线程。
                </p>
              </div>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                第一步：审查发现 ({findingsCount})
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">Findings</span>
              </h2>
              <FindingsList findings={mergedFindings} />
            </section>

            <FindingEvidencePanel
              reviewId={result.review_id}
              findings={result.summary.findings}
              adText={text}
              countryId={result.summary.advertisement.country_id}
              categoryId={result.summary.advertisement.category_id}
            />

            <SourceMaterial text={text} highlightSpans={highlightSpans} imagePreviews={imagePreviews} />
          </>
        )}
      </div>
    </div>
  );
}
