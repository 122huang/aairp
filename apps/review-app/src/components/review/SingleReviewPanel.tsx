import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  DEMO_REVIEW_PLATFORM_ID,
  type DemoReviewCountryId,
  type DemoSaCategoryId,
  type EvidenceSourceType,
} from '@aairp/shared-kernel';
import { fetchCase } from '@/api/cases';
import { submitReview, type DemoReviewResponse, type ReviewApiError } from '@/api/review';
import { openCaseReport } from '@/api/case-report';
import { SharedReviewDimensions } from '@/components/review/SharedReviewDimensions';
import { ReviewContextFields } from '@/components/review/ReviewContextFields';
import { OverallDecisionBanner } from '@/components/review/OverallDecisionBanner';
import { ClaimOpinionList } from '@/components/review/ClaimOpinionList';
import { ReviewSectionPanel } from '@/components/review/ReviewSectionPanel';
import { SourceMaterial } from '@/components/review/SourceMaterial';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type AdTypeValue } from '@/lib/ad-type-copy';
import { mergeFindingsByClaimAnchor, extractEvidenceSpans } from '@/lib/finding-merge';
import { CLAIM_OPINION_PRE_REVIEW_DISCLAIMER } from '@/lib/legal-copy';
import {
  copySectionStatus,
  evidenceSectionStatus,
  filterCopyOpinions,
  filterEvidenceOpinions,
} from '@/lib/review-result-view';
import { buildReviewUploadContext, resolveCaseProductSku } from '@/lib/review-upload-context';
import {
  applyEvidenceListAction,
  captureReviewInputSnapshot,
  isBoundReviewResultStale,
  reviewSubmitLogFields,
  shouldAcceptReviewResponse,
  type ReviewInputSnapshot,
} from '@/lib/review-input-snapshot';
import { collectHighlightSpans, filesToBase64, fileToRawBase64, severityRank } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { EVIDENCE_SOURCE_TYPE_OPTIONS } from '@/api/evidence';
import { Loader2, Upload, X } from 'lucide-react';

const EVIDENCE_FILE_ACCEPT = '.pdf,.txt,.md';
const EVIDENCE_FILE_EXTENSIONS = ['.pdf', '.txt', '.md'] as const;
const EVIDENCE_POOL_MAX_FILES = 5;
const EVIDENCE_POOL_MAX_BYTES = 10 * 1024 * 1024;

function isAcceptedEvidenceFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return EVIDENCE_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

function mimeForEvidenceFile(file: File): string {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.md')) return 'text/markdown';
  return file.type || 'text/plain';
}

type SingleReviewPanelProps = {
  countryId: DemoReviewCountryId | '';
  categoryId: DemoSaCategoryId;
  onCountryChange: (value: DemoReviewCountryId) => void;
  onCategoryChange: (value: DemoSaCategoryId) => void;
  onCountryRequired?: () => void;
  countryShake?: boolean;
  /** Restore resubmit context from `#/?parent_case_id=` (survives refresh via URL). */
  initialParentCaseId?: string;
  /** When Image Review tab is enabled, hint users away from treating attachments as full image review. */
  showImageReviewHint?: boolean;
};

export function SingleReviewPanel({
  countryId,
  categoryId,
  onCountryChange,
  onCategoryChange,
  onCountryRequired,
  countryShake,
  initialParentCaseId,
  showImageReviewHint = false,
}: SingleReviewPanelProps) {
  const [text, setText] = useState('');
  const [adType, setAdType] = useState<AdTypeValue>('');
  const [productSku, setProductSku] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceSourceType, setEvidenceSourceType] = useState<EvidenceSourceType>('INTERNAL_TEST');
  const [loading, setLoading] = useState(false);
  const [loadingElapsedSec, setLoadingElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoReviewResponse | null>(null);
  /** Material snapshot that produced `result`. */
  const [resultSnapshot, setResultSnapshot] = useState<ReviewInputSnapshot | null>(null);
  /** Next submit joins this parent case's thread (set via resubmit button or URL). */
  const [pendingParentCaseId, setPendingParentCaseId] = useState<string | null>(
    initialParentCaseId ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const restoredParentRef = useRef<string | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);
  const submitGenerationRef = useRef(0);
  const latestMaterialRef = useRef({
    countryId,
    categoryId,
    adType,
    productSku,
    copy: text,
    images: imageFiles,
    evidence: evidenceFiles,
    evidenceSourceType,
  });
  latestMaterialRef.current = {
    countryId,
    categoryId,
    adType,
    productSku,
    copy: text,
    images: imageFiles,
    evidence: evidenceFiles,
    evidenceSourceType,
  };

  function patchLatest(
    patch: Partial<(typeof latestMaterialRef)['current']>,
  ): (typeof latestMaterialRef)['current'] {
    latestMaterialRef.current = { ...latestMaterialRef.current, ...patch };
    return latestMaterialRef.current;
  }

  function commitEvidence(
    action: Parameters<typeof applyEvidenceListAction<File>>[1],
  ): File[] {
    const next = applyEvidenceListAction(latestMaterialRef.current.evidence, action);
    patchLatest({ evidence: next });
    setEvidenceFiles(next);
    return next;
  }

  function commitImages(next: File[]): File[] {
    patchLatest({ images: next });
    setImageFiles(next);
    return next;
  }

  useEffect(() => {
    if (!loading) {
      setLoadingElapsedSec(0);
      return;
    }
    setLoadingElapsedSec(0);
    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      setLoadingElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [loading]);

  const currentSnapshot = captureReviewInputSnapshot({
    countryId,
    categoryId,
    adType,
    productSku,
    copy: text,
    images: imageFiles,
    evidence: evidenceFiles,
    evidenceSourceType,
  });
  const resultStale = Boolean(result && isBoundReviewResultStale(currentSnapshot, resultSnapshot));
  const resultSourceText = resultSnapshot?.copy ?? '';

  const mergedFindings = useMemo(() => {
    if (!result) return [];
    const sorted = [...result.summary.findings].sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity),
    );
    return mergeFindingsByClaimAnchor(sorted);
  }, [result]);

  const highlightSpans = useMemo(() => {
    if (!result) return [];
    const spans = result.summary.findings.flatMap(extractEvidenceSpans);
    return collectHighlightSpans(resultSourceText, spans);
  }, [result, resultSourceText]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    commitImages(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
    event.target.value = '';
  }

  function clearImages() {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    commitImages([]);
    setImagePreviews([]);
  }

  function handleEvidenceChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;
    const rejectedType = picked.find((file) => !isAcceptedEvidenceFile(file));
    if (rejectedType) {
      setError('支撑材料仅支持 PDF、TXT 或 MD（文字层文件）。广告图请在上方上传。');
      return;
    }
    const oversized = picked.find((file) => file.size > EVIDENCE_POOL_MAX_BYTES);
    if (oversized) {
      setError('单个支撑材料不超过 10MB。');
      return;
    }
    const beforeCount = latestMaterialRef.current.evidence.length;
    commitEvidence({ type: 'add', files: picked });
    if (beforeCount + picked.length > EVIDENCE_POOL_MAX_FILES) {
      setError(`最多上传 ${EVIDENCE_POOL_MAX_FILES} 份支撑材料。`);
    } else {
      setError(null);
    }
  }

  function clearEvidence() {
    commitEvidence({ type: 'clear' });
  }

  function removeEvidenceFile(index: number) {
    commitEvidence({ type: 'remove', index });
  }

  useEffect(() => {
    if (!initialParentCaseId) return;
    if (restoredParentRef.current === initialParentCaseId) return;
    restoredParentRef.current = initialParentCaseId;
    setPendingParentCaseId(initialParentCaseId);
    setResult(null);
    setResultSnapshot(null);
    setError(null);
    void fetchCase(initialParentCaseId)
      .then((record) => {
        setText(record.advertisement.content.text ?? '');
        const restoredAdType = record.advertisement.ad_type;
        if (restoredAdType === 'BRAND_PRODUCT' || restoredAdType === 'INFLUENCER_UGC') {
          setAdType(restoredAdType);
        }
        setProductSku(resolveCaseProductSku(record));
        onCountryChange(record.dimensions.country_id as DemoReviewCountryId);
        onCategoryChange(record.dimensions.category_id as DemoSaCategoryId);
        setImagePreviews(record.advertisement.content.image_urls ?? []);
        window.requestAnimationFrame(() => {
          textAreaRef.current?.focus();
          textAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      })
      .catch(() => {
        setError(`无法加载案例 ${initialParentCaseId}，仍可手动填写后重新提交（线程关联已就绪）。`);
      });
  }, [initialParentCaseId, onCountryChange, onCategoryChange]);

  function handleResubmitFromCase() {
    if (!result?.case_id) return;
    // Persist via URL so refresh / later return can restore the same parent case.
    window.location.hash = `#/?parent_case_id=${encodeURIComponent(result.case_id)}`;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const latest = latestMaterialRef.current;
    const trimmed = latest.copy.trim();
    if (!trimmed && latest.images.length === 0) {
      setError('请输入广告文案或上传至少一张图片');
      return;
    }

    if (!latest.countryId) {
      setError('请先选择目标市场');
      onCountryRequired?.();
      return;
    }

    submitAbortRef.current?.abort();
    const abortController = new AbortController();
    submitAbortRef.current = abortController;
    const generation = ++submitGenerationRef.current;
    const submissionSnapshot = captureReviewInputSnapshot(latest);
    const requestId = crypto.randomUUID();
    if (import.meta.env.DEV) {
      console.info('[review-submit]', reviewSubmitLogFields(submissionSnapshot, requestId));
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setResultSnapshot(null);

    try {
      const { imageDataUrls } = await filesToBase64(latest.images);
      const evidencePayload =
        submissionSnapshot.evidence.length === 0
          ? undefined
          : await Promise.all(
              latest.evidence.map(async (file) => ({
                filename: file.name,
                mime_type: mimeForEvidenceFile(file),
                content_base64: await fileToRawBase64(file),
                evidence_source_type: latest.evidenceSourceType,
              })),
            );
      const uploadContext = buildReviewUploadContext(latest.adType, latest.productSku);
      const response = await submitReview(
        {
          country_id: latest.countryId,
          platform_id: DEMO_REVIEW_PLATFORM_ID,
          category_id: latest.categoryId,
          content: {
            text: submissionSnapshot.copy,
            ...(imageDataUrls.length > 0 ? { images: imageDataUrls } : {}),
          },
          ...(uploadContext ? { context: uploadContext } : {}),
          tags: ['review-app:6u-1', `market:${latest.countryId}`],
          ...(pendingParentCaseId ? { parent_case_id: pendingParentCaseId } : {}),
          ...(evidencePayload ? { evidence_files: evidencePayload } : {}),
        },
        { signal: abortController.signal, requestId },
      );
      if (
        !shouldAcceptReviewResponse({
          generation,
          latestGeneration: submitGenerationRef.current,
          aborted: abortController.signal.aborted,
        })
      ) {
        return;
      }
      setPendingParentCaseId(null);
      setResult(response);
      setResultSnapshot(submissionSnapshot);
    } catch (caught) {
      if (generation !== submitGenerationRef.current) {
        return;
      }
      const apiError = caught as ReviewApiError;
      if (apiError.status === 499) {
        return;
      }
      setError(apiError.message ?? '提交失败，请稍后重试');
      setResult(null);
      setResultSnapshot(null);
    } finally {
      if (generation === submitGenerationRef.current) {
        setLoading(false);
      }
    }
  }

  const findingsCount = mergedFindings.length;
  const claimOpinions = result?.claim_opinions ?? [];
  const copySection = useMemo(
    () =>
      copySectionStatus(
        result?.copy_decision ?? result?.final_decision ?? 'WARN',
        findingsCount,
      ),
    [result?.copy_decision, result?.final_decision, findingsCount],
  );
  const evidenceSection = useMemo(
    () => evidenceSectionStatus(claimOpinions, result?.evidence_cleared),
    [claimOpinions, result?.evidence_cleared],
  );
  const copyOpinions = useMemo(() => filterCopyOpinions(claimOpinions), [claimOpinions]);
  const evidenceOpinions = useMemo(() => filterEvidenceOpinions(claimOpinions), [claimOpinions]);
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
                onChange={(event) => {
                  const copy = event.target.value;
                  patchLatest({ copy });
                  setText(copy);
                }}
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

            <ReviewContextFields
              productSku={productSku}
              adType={adType}
              onProductSkuChange={(value) => {
                patchLatest({ productSku: value });
                setProductSku(value);
              }}
              onAdTypeChange={(value) => {
                patchLatest({ adType: value });
                setAdType(value);
              }}
              disabled={loading}
            />

            <div className="space-y-2">
              <Label className="font-medium text-ink">广告图（可选）</Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                用于投放画面。检测报告请在下方「支撑材料」中上传。
              </p>
              {showImageReviewHint && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  附图不会替代完整审图流程。完整审图请改用「图片审查」入口（识别 → 核对 → 审查）。
                </p>
              )}
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

            <div className="space-y-2 border-t border-gray-100 pt-4">
              <Label className="font-medium text-ink">支撑材料（可选）</Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                检测报告、认证文件、调查数据。如有，请一并上传；无材料亦可先审文案。
              </p>
              <input
                ref={evidenceInputRef}
                type="file"
                accept={EVIDENCE_FILE_ACCEPT}
                multiple
                className="hidden"
                onChange={handleEvidenceChange}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => evidenceInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  上传材料
                </Button>
                {evidenceFiles.length > 0 && (
                  <Button type="button" variant="ghost" onClick={clearEvidence}>
                    <X className="h-4 w-4" />
                    清除 {evidenceFiles.length} 份
                  </Button>
                )}
              </div>
              {evidenceFiles.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {evidenceFiles.map((file, index) => (
                    <li
                      key={`${file.name}:${file.size}:${index}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-ink"
                    >
                      <span className="min-w-0 truncate">{file.name}</span>
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground hover:text-ink"
                        onClick={() => removeEvidenceFile(index)}
                        aria-label={`移除 ${file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="evidence-source-type" className="text-xs text-muted-foreground">
                  材料类型
                </Label>
                <select
                  id="evidence-source-type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={evidenceSourceType}
                  disabled={loading}
                  onChange={(event) => {
                    const next = event.target.value as EvidenceSourceType;
                    patchLatest({ evidenceSourceType: next });
                    setEvidenceSourceType(next);
                  }}
                >
                  {EVIDENCE_SOURCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  未选择时按企业内部测试处理，判断标准更严。
                </p>
              </div>
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
              <p className="text-sm font-semibold text-ink">提交后，初审意见将显示于此</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                将逐条说明每句表述的结论及依据。无支撑材料亦可先审文案。
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div
            className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-6 py-10 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            <div className="space-y-1">
              <p>正在运行合规审查…</p>
              <p>
                已等待 {loadingElapsedSec}s，通常 1–2 分钟
              </p>
            </div>
          </div>
        )}

        {result && !loading && (
          <>
            {resultStale && (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
                role="status"
              >
                输入已变更（市场、文案、广告图或支撑材料），下方仍是<strong>上一稿</strong>的审查结果，不是当前输入的审核结论。
                请重新点击「提交审查」。
              </div>
            )}

            <div
              key={result.review_id}
              className={cn('flex flex-col space-y-5', resultStale && 'pointer-events-none opacity-60')}
              aria-disabled={resultStale}
            >
              <p
                className="rounded-md border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-ink/80"
                role="note"
              >
                {CLAIM_OPINION_PRE_REVIEW_DISCLAIMER}
              </p>

              <OverallDecisionBanner
                decision={result.overall_decision ?? result.final_decision}
                evidenceCleared={result.evidence_cleared}
                findingsCount={findingsCount}
              />

              {result.case_id && (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={resultStale}
                      onClick={() => openCaseReport(result.case_id!, 'business_handoff')}
                    >
                      导出业务提醒摘要
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={resultStale}
                      onClick={() => openCaseReport(result.case_id!, 'legal_audit')}
                    >
                      导出完整审核报告
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={resultStale}
                      onClick={handleResubmitFromCase}
                    >
                      基于此案例修改后重新提交
                    </Button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    业务提醒摘要在 PASS / WARN / REVIEW 时可导出；REJECT 不可导出。完整审核报告始终可导出。重新提交将关联到同一审查线程。
                  </p>
                </div>
              )}

              <ReviewSectionPanel title="文案审核" status={copySection}>
                <ClaimOpinionList
                  mode="copy"
                  opinions={copyOpinions}
                  emptyText="文案层未发现需逐条说明的宣称意见。"
                />
              </ReviewSectionPanel>

              <ReviewSectionPanel title="证据材料" status={evidenceSection}>
                <ClaimOpinionList
                  mode="evidence"
                  opinions={evidenceOpinions}
                  emptyText="本次无材料层判断项（未附材料或无可附材料的宣称）。"
                />
              </ReviewSectionPanel>

              <SourceMaterial
                text={resultSourceText}
                highlightSpans={highlightSpans}
                imagePreviews={imagePreviews}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
