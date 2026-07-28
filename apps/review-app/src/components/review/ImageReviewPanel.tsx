import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  DEMO_REVIEW_PLATFORM_ID,
  type DemoReviewCountryId,
  type DemoSaCategoryId,
} from '@aairp/shared-kernel';
import {
  extractImageReviewText,
  submitReview,
  type DemoReviewResponse,
  type ReviewApiError,
} from '@/api/review';
import { openCaseReport } from '@/api/case-report';
import { SharedReviewDimensions } from '@/components/review/SharedReviewDimensions';
import { ReviewContextFields } from '@/components/review/ReviewContextFields';
import { DecisionBanner } from '@/components/review/DecisionBanner';
import { FindingsList } from '@/components/review/FindingsList';
import { FindingEvidencePanel } from '@/components/review/FindingEvidencePanel';
import { SourceMaterial } from '@/components/review/SourceMaterial';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type AdTypeValue } from '@/lib/ad-type-copy';
import { mergeFindingsByClaimAnchor, extractEvidenceSpans } from '@/lib/finding-merge';
import { buildReviewUploadContext } from '@/lib/review-upload-context';
import { collectHighlightSpans, filesToBase64, severityRank } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Loader2, ScanText, Upload, X } from 'lucide-react';

type ImageReviewPanelProps = {
  countryId: DemoReviewCountryId | '';
  categoryId: DemoSaCategoryId;
  onCountryChange: (value: DemoReviewCountryId) => void;
  onCategoryChange: (value: DemoSaCategoryId) => void;
  onCountryRequired?: () => void;
  countryShake?: boolean;
};

type IdentifyPhase = 'idle' | 'extracting' | 'ready';

export function ImageReviewPanel({
  countryId,
  categoryId,
  onCountryChange,
  onCategoryChange,
  onCountryRequired,
  countryShake,
}: ImageReviewPanelProps) {
  const [confirmedText, setConfirmedText] = useState('');
  const [adType, setAdType] = useState<AdTypeValue>('');
  const [productSku, setProductSku] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [identifyPhase, setIdentifyPhase] = useState<IdentifyPhase>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoReviewResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mergedFindings = useMemo(() => {
    if (!result) return [];
    const sorted = [...result.summary.findings].sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity),
    );
    return mergeFindingsByClaimAnchor(sorted);
  }, [result]);

  const refIds = useMemo(() => {
    if (!result) return [];
    return [...new Set(result.summary.findings.map((f) => f.ref_id))];
  }, [result]);

  const highlightSpans = useMemo(() => {
    if (!result) return [];
    const spans = result.summary.findings.flatMap(extractEvidenceSpans);
    return collectHighlightSpans(confirmedText, spans);
  }, [result, confirmedText]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      event.target.value = '';
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setIdentifyPhase('idle');
    setConfirmedText('');
    setResult(null);
    setError(null);
    event.target.value = '';
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setIdentifyPhase('idle');
    setConfirmedText('');
  }

  async function handleExtract() {
    if (!imageFile) {
      setError('请先上传图片');
      return;
    }
    setIdentifyPhase('extracting');
    setError(null);
    setResult(null);

    try {
      const { imageDataUrls } = await filesToBase64([imageFile]);
      const dataUrl = imageDataUrls[0] ?? '';
      const comma = dataUrl.indexOf(',');
      const imageBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const mimeMatch = /^data:([^;]+);base64,/.exec(dataUrl);
      const response = await extractImageReviewText({
        image_base64: imageBase64,
        mime_type: mimeMatch?.[1] ?? (imageFile.type || 'image/jpeg'),
        ...(countryId ? { country_id: countryId } : {}),
        category_id: categoryId,
      });
      setConfirmedText(response.text);
      setIdentifyPhase('ready');
    } catch (caught) {
      const apiError = caught as ReviewApiError;
      setError(apiError.message ?? '识别失败，请稍后重试或手动粘贴文本');
      setIdentifyPhase('idle');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!imageFile) {
      setError('请先上传图片后再开始审查');
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
      const { imageDataUrls } = await filesToBase64([imageFile]);
      const uploadContext = buildReviewUploadContext(adType, productSku);
      const response = await submitReview({
        country_id: countryId,
        platform_id: DEMO_REVIEW_PLATFORM_ID,
        category_id: categoryId,
        content: {
          text: confirmedText.trim(),
          images: imageDataUrls,
        },
        ...(uploadContext ? { context: uploadContext } : {}),
        tags: ['review-app:6u-1', `market:${countryId}`, 'entry_mode:image'],
        entry_mode: 'image',
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
  const busy = loading || identifyPhase === 'extracting';
  const canExtract = Boolean(imageFile) && !busy;
  const canSubmit = Boolean(imageFile) && countrySelected && !busy;

  return (
    <div className="grid flex-1 gap-8 lg:grid-cols-[2fr_3fr]">
      <Card className="h-fit">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-ink">图片审查</CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            先上传图片识别可见文字，核对后再提交 — 走与文案审查相同的合规管线。
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label className="font-medium text-ink">图片（必填，单张）</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  上传图片
                </Button>
                {imageFile && (
                  <Button type="button" variant="ghost" disabled={busy} onClick={clearImage}>
                    <X className="h-4 w-4" />
                    清除
                  </Button>
                )}
              </div>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="预览"
                  className="mt-1 max-h-48 w-auto rounded-md border border-gray-200 object-contain"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={!canExtract} onClick={handleExtract}>
                {identifyPhase === 'extracting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    识别中…
                  </>
                ) : (
                  <>
                    <ScanText className="h-4 w-4" />
                    识别文字
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image-confirmed-text" className="font-medium text-ink">
                识别文本（可编辑核对）
              </Label>
              <Textarea
                id="image-confirmed-text"
                value={confirmedText}
                onChange={(event) => {
                  setConfirmedText(event.target.value);
                  if (identifyPhase === 'idle' && event.target.value.trim()) {
                    setIdentifyPhase('ready');
                  }
                }}
                placeholder="点击「识别文字」后填入，也可手动粘贴后核对…"
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                {identifyPhase === 'ready'
                  ? '请核对识别结果后再开始审查。空核对稿 + 不可读图将触发可读性门禁。'
                  : '建议先识别再审；也可直接粘贴可见文字后提交。'}
              </p>
            </div>

            <SharedReviewDimensions
              countryId={countryId}
              categoryId={categoryId}
              onCountryChange={onCountryChange}
              onCategoryChange={onCategoryChange}
              disabled={busy}
              countryShake={countryShake}
            />

            <ReviewContextFields
              productSku={productSku}
              adType={adType}
              onProductSkuChange={setProductSku}
              onAdTypeChange={setAdType}
              disabled={busy}
            />

            {error && (
              <div className="rounded-md border border-red-200 bg-[#FEF2F2] px-3 py-2 text-sm text-reject">
                {error}
              </div>
            )}

            <div
              onClick={() => {
                if (!imageFile && !busy) {
                  setError('请先上传图片后再开始审查');
                  return;
                }
                if (!countrySelected && !busy) {
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
                  '开始审查'
                )}
              </Button>
            </div>
            {!imageFile && (
              <p className="text-center text-xs text-reject">⚠ 图片审查需先上传图片</p>
            )}
            {imageFile && !countrySelected && (
              <p className="text-center text-xs text-reject">⚠ 请先选择目标市场后提交</p>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col space-y-5">
        {!result && !loading && identifyPhase !== 'extracting' && (
          <div className="flex min-h-[28rem] flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-10">
            <div className="mx-auto max-w-sm text-center">
              <p className="text-sm font-semibold text-ink">审查结果将显示在这里</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                上传长图 → 识别文字 → 核对文本 → 开始审查。
              </p>
            </div>
          </div>
        )}

        {(loading || identifyPhase === 'extracting') && (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {identifyPhase === 'extracting' ? '正在识别图片可见文字…' : '正在运行合规审查管线…'}
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
                </div>
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
              adText={confirmedText}
              countryId={result.summary.advertisement.country_id}
              categoryId={result.summary.advertisement.category_id}
              productSku={productSku.trim() || undefined}
            />

            <SourceMaterial
              text={confirmedText}
              highlightSpans={highlightSpans}
              imagePreviews={imagePreview ? [imagePreview] : []}
            />
          </>
        )}
      </div>
    </div>
  );
}
