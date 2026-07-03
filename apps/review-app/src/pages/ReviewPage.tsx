import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  DEMO_REVIEW_COUNTRIES,
  DEMO_SA_CATEGORIES,
  DEMO_REVIEW_PLATFORM_ID,
  type DemoReviewCountryId,
  type DemoSaCategoryId,
} from '@aairp/shared-kernel';
import { submitReview, type DemoReviewResponse, type ReviewApiError } from '@/api/review';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { DecisionBanner } from '@/components/review/DecisionBanner';
import { FindingsList } from '@/components/review/FindingsList';
import { SourceMaterial } from '@/components/review/SourceMaterial';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useViewMode } from '@/hooks/use-view-mode';
import { mergeFindingsByRiskType, extractEvidenceSpans } from '@/lib/finding-merge';
import { collectHighlightSpans, filesToBase64, severityRank } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Loader2, Upload, X } from 'lucide-react';

export function ReviewPage() {
  const [viewMode, setViewMode] = useViewMode();
  const [text, setText] = useState('');
  const [countryId, setCountryId] = useState<DemoReviewCountryId | ''>('');
  const [categoryId, setCategoryId] = useState<DemoSaCategoryId>('sa.other');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoReviewResponse | null>(null);
  const [countryShake, setCountryShake] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function triggerCountryShake() {
    setCountryShake(true);
    window.setTimeout(() => setCountryShake(false), 100);
  }

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && imageFiles.length === 0) {
      setError('请输入广告文案或上传至少一张图片');
      return;
    }

    if (!countryId) {
      setError('请先选择目标市场');
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
        tags: ['review-app:6u-1', `market:${countryId}`],
      });
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
    <div className="flex min-h-screen flex-col bg-surface">
      <AppHeader viewMode={viewMode} onViewModeChange={setViewMode} />

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 py-8 lg:grid-cols-[2fr_3fr]">
        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold text-ink">审查内容</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="ad-text" className="font-medium text-ink">
                  文案内容
                </Label>
                <Textarea
                  id="ad-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="粘贴广告文案，支持中英文混排…"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className={cn('space-y-2', countryShake && 'animate-shake')}>
                  <Label className="font-medium text-ink">
                    国家 <span className="text-reject">*</span>
                  </Label>
                  <Select
                    value={countryId || undefined}
                    onValueChange={(value) => setCountryId(value as DemoReviewCountryId)}
                  >
                    <SelectTrigger
                      className={cn(
                        'bg-white',
                        countrySelected ? 'border-gray-200' : 'border-orange-300',
                      )}
                    >
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_REVIEW_COUNTRIES.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.id} · {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium text-ink">品类</Label>
                  <Select value={categoryId} onValueChange={(value) => setCategoryId(value as DemoSaCategoryId)}>
                    <SelectTrigger className="border-gray-200 bg-white">
                      <SelectValue placeholder="选择品类" />
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
                    triggerCountryShake();
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
                <p className="text-center text-xs text-reject">
                  ⚠ 请先选择目标市场后提交
                </p>
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
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  右上角可切换法务视图与业务视图。
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
                viewMode={viewMode}
                decision={result.final_decision}
                confidence={result.confidence}
                rationale={result.rationale}
                refIds={refIds}
                findingsCount={findingsCount}
              />

              <section>
                <h2 className="mb-3 text-sm font-semibold text-ink">
                  审查发现 ({findingsCount})
                  {viewMode === 'legal' && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">Findings</span>
                  )}
                </h2>
                <FindingsList viewMode={viewMode} findings={mergedFindings} />
              </section>

              <SourceMaterial text={text} highlightSpans={highlightSpans} imagePreviews={imagePreviews} />
            </>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
