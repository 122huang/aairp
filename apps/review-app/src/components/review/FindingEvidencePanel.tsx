import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react';
import { AlertTriangle, Check, FileText, Loader2, Paperclip, Upload } from 'lucide-react';
import type { ReviewFindingDto } from '@/api/review';
import {
  attachFindingEvidence,
  confirmFindingEvidence,
  EVIDENCE_SOURCE_TYPE_OPTIONS,
  listFindingEvidence,
  type EvidenceAiJudgmentDto,
  type FindingEvidenceLinkDto,
} from '@/api/evidence';
import {
  groupFindingsByClaimAnchor,
  supportsEvidenceAttachment,
} from '@aairp/shared-kernel';
import { resolveLegalSummaryZh } from '@/lib/legal-copy';
import { resolveFindingRiskType } from '@/lib/finding-merge';
import { findingDecisionBadgeClass, severityBadgeClass } from '@/lib/review-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const inputClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

/** Keep in sync with the hidden file input `accept` attribute. */
const EVIDENCE_FILE_ACCEPT = '.pdf,.txt,.md';
const EVIDENCE_FILE_EXTENSIONS = ['.pdf', '.txt', '.md'] as const;

function isAcceptedEvidenceFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return EVIDENCE_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

type FindingEvidencePanelProps = {
  reviewId: string;
  findings: ReviewFindingDto[];
  adText: string;
  countryId: string;
  categoryId: string;
  productSku?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function JudgmentBadge({ judgment }: { judgment: EvidenceAiJudgmentDto }) {
  const sufficient = judgment.sufficiency === 'sufficient' && judgment.relevance !== 'none';
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-ink">
          关联性: {judgment.relevance}
        </span>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-xs font-medium',
            sufficient ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900',
          )}
        >
          充分性: {judgment.sufficiency}
        </span>
        {judgment.judgment_mode && (
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-medium',
              judgment.judgment_mode === 'live'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-rose-100 text-rose-900',
            )}
          >
            模式: {judgment.judgment_mode}
            {judgment.llm_model ? ` (${judgment.llm_model})` : ''}
          </span>
        )}
        {judgment.prescreen_excluded && (
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">结构化预筛</span>
        )}
        {judgment.text_unreadable && (
          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-900">
            文本层不可读
          </span>
        )}
        {judgment.text_truncated && (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            文本已截断
          </span>
        )}
      </div>
      {judgment.judgment_mode === 'stub' && (
        <p className="text-xs leading-relaxed text-rose-800">
          当前为 stub 模式：系统不会读取真实文档内容，返回的是固定演示结果。生产环境请设置
          AAIRP_EVIDENCE_JUDGMENT_MODE=live。
        </p>
      )}
      {judgment.text_unreadable && (
        <p className="text-xs leading-relaxed text-rose-800">
          未能从文件提取可读文本（PDF 使用标准文字层解析；扫描件/纯图片 PDF 仍需 OCR，v1
          未覆盖）。请改传可选中文字的 PDF 或 .txt 后重试。
        </p>
      )}
      {judgment.text_truncated &&
        typeof judgment.text_prompt_len === 'number' &&
        typeof judgment.text_full_len === 'number' && (
          <p className="text-xs leading-relaxed text-amber-900">
            证据文本较长，AI 判断仅基于前 {judgment.text_prompt_len.toLocaleString()} 字符（全文共{' '}
            {judgment.text_full_len.toLocaleString()}{' '}
            字符）。确认结论前请自行核对文档后部内容，勿把 AI 摘录当作全文覆盖。
          </p>
        )}
    </div>
  );
}

function SideBySideReview({
  claimAnchor,
  judgment,
}: {
  claimAnchor: string;
  judgment: EvidenceAiJudgmentDto;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2.5">
        <p className="mb-1 text-xs font-medium text-amber-900">原文宣称片段</p>
        <p className="font-mono text-xs leading-relaxed text-ink">{claimAnchor || '(无定位片段)'}</p>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2.5">
        <p className="mb-1 text-xs font-medium text-blue-900">证据摘录（AI提取）</p>
        <p className="text-xs leading-relaxed text-ink">
          {judgment.extracted_key_facts?.trim() || '(未提取到关键事实)'}
        </p>
      </div>
    </div>
  );
}

function FindingEvidenceItem({
  reviewId,
  findings,
  claimAnchor,
  adText,
  countryId,
  categoryId,
  productSku,
}: {
  reviewId: string;
  findings: ReviewFindingDto[];
  claimAnchor: string;
  adText: string;
  countryId: string;
  categoryId: string;
  productSku?: string;
}) {
  const primaryFinding =
    findings.find((f) => f.module === 'RULE') ??
    findings.find((f) => f.module === 'PLAYBOOK') ??
    findings[0]!;
  const findingIds = findings.map((f) => f.finding_id);
  const findingIdsKey = findingIds.slice().sort().join('|');
  const refIds = [...new Set(findings.map((f) => f.ref_id))];
  const riskTypes = [...new Set(findings.map((f) => resolveFindingRiskType(f)))];

  const [links, setLinks] = useState<FindingEvidenceLinkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<(typeof EVIDENCE_SOURCE_TYPE_OPTIONS)[number]['value']>('INTERNAL_TEST');
  const [scopeSkus, setScopeSkus] = useState(productSku ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function applySelectedFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    if (!isAcceptedEvidenceFile(next)) {
      setError('仅支持 PDF / TXT / MD 文件');
      return;
    }
    setError(null);
    setFile(next);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    if (event.dataTransfer.types.includes('Files')) {
      setDragActive(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragActive(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types.includes('Files')) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (submitting) return;
    const dropped = event.dataTransfer.files?.[0] ?? null;
    applySelectedFile(dropped);
  }

  const primaryRiskType = resolveFindingRiskType(primaryFinding);
  const legalSummaryZh = resolveLegalSummaryZh({
    riskType: primaryRiskType,
    modules: findings.map((f) => f.module),
    severity: primaryFinding.severity,
    decision: primaryFinding.decision,
    summary: primaryFinding.summary,
    refIds,
    rewriteSuggestions: findings.flatMap((f) => f.rewrite_suggestions ?? []),
    evidenceSpans: findings.flatMap((f) => f.evidence_spans ?? []),
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const lists = await Promise.all(
        findingIds.map((id) => listFindingEvidence(reviewId, id)),
      );
      const merged = new Map<string, FindingEvidenceLinkDto>();
      for (const list of lists) {
        for (const link of list) {
          merged.set(link.link_id, link);
        }
      }
      setLinks([...merged.values()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加载证据失败');
    } finally {
      setLoading(false);
    }
    // findingIdsKey keeps the callback stable while covering the full fan-out set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId, findingIdsKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAttach(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !file) {
      setError('请填写证据标题并选择文件');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const scope = {
        countries: [countryId],
        categories: [categoryId],
        skus: scopeSkus.trim() ? scopeSkus.split(/[,;，；\s]+/).filter(Boolean) : undefined,
      };
      const errors: string[] = [];
      for (const finding of findings) {
        try {
          await attachFindingEvidence({
            review_id: reviewId,
            finding_id: finding.finding_id,
            title: title.trim(),
            evidence_source_type: sourceType,
            scope,
            claim_risk_types: [resolveFindingRiskType(finding)],
            file: {
              filename: file.name,
              mime_type: file.type || 'application/octet-stream',
              content_base64: contentBase64,
            },
            judgment_context: {
              country_id: countryId,
              category_id: categoryId,
              product_sku: productSku,
              ad_text: adText,
              finding_summary: finding.summary,
              remediation_type: finding.remediation_type,
              risk_type: resolveFindingRiskType(finding),
              claim_anchor_text: claimAnchor,
              matched_spans: finding.evidence_spans,
            },
          });
        } catch (caught) {
          errors.push(
            `${finding.ref_id}: ${caught instanceof Error ? caught.message : '上传失败'}`,
          );
        }
      }
      if (errors.length === findings.length) {
        setError(errors.join('；'));
        return;
      }
      setTitle('');
      setFile(null);
      setShowForm(false);
      if (errors.length > 0) {
        setError(`部分 finding 同步失败：${errors.join('；')}`);
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '上传失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(linkId: string, action: 'confirm' | 'override_accept' | 'override_reject') {
    setConfirmingId(linkId);
    setError(null);
    try {
      await confirmFindingEvidence(linkId, action, overrideReason.trim() || undefined);
      setShowOverrideForm(null);
      setOverrideReason('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setConfirmingId(null);
    }
  }

  const trigger = claimAnchor.trim();

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-2">
          {riskTypes.map((rt) => (
            <span key={rt} className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-ink">
              {rt}
            </span>
          ))}
          {primaryFinding.remediation_type && (
            <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-gray-500">
              {primaryFinding.remediation_type}
            </span>
          )}
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-medium',
              findingDecisionBadgeClass(primaryFinding.decision),
            )}
          >
            {primaryFinding.decision}
          </span>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-medium',
              severityBadgeClass(primaryFinding.severity),
            )}
          >
            {primaryFinding.severity}
          </span>
          {findings.length > 1 && (
            <span className="rounded-md bg-white px-2 py-0.5 text-xs text-gray-500">
              一次上传同步 {findings.length} 条 finding
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-ink">{legalSummaryZh}</p>
            {refIds.length > 1 && (
              <p className="mt-1 font-mono text-[11px] text-gray-500">{refIds.join(' · ')}</p>
            )}
          </div>
        </div>

        {trigger && (
          <div className="font-mono text-xs">
            <span className="rounded bg-highlight px-1.5 py-0.5 text-ink">{trigger}</span>
          </div>
        )}

        {loading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 加载已附证据…
          </p>
        ) : links.length > 0 ? (
          <div className="space-y-3">
            {links.map((link) => {
              const ai = link.ai_judgment;
              const finalized = link.status === 'HUMAN_CONFIRMED' || link.status === 'HUMAN_OVERRODE';
              return (
                <div key={link.link_id} className="space-y-2 rounded-md border border-gray-200 bg-white p-3">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink/60" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{link.evidence.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {[
                          link.evidence.evidence_source_type,
                          link.evidence.issuing_institution,
                          link.evidence.file.filename,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>

                  {ai && (
                    <>
                      <JudgmentBadge judgment={ai} />
                      <SideBySideReview claimAnchor={claimAnchor} judgment={ai} />
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">AI 推理详情</summary>
                        <p className="mt-1">{ai.relevance_reasoning}</p>
                        <p className="mt-1">{ai.sufficiency_reasoning}</p>
                      </details>
                    </>
                  )}

                  {link.status === 'AI_PENDING' && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI 判断中…
                    </p>
                  )}

                  {finalized && (
                    <p className="flex items-center gap-1 text-xs text-pass">
                      <Check className="h-3.5 w-3.5" />
                      {link.status === 'HUMAN_CONFIRMED' ? '已确认 AI 判断' : '人工覆写'}
                      {link.override_reason ? ` — ${link.override_reason}` : ''}
                    </p>
                  )}

                  {link.status === 'AI_JUDGED_PENDING_CONFIRMATION' && ai && (
                    <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={confirmingId === link.link_id}
                        onClick={() => void handleConfirm(link.link_id, 'confirm')}
                      >
                        确认 AI 判断
                      </Button>
                      {ai.sufficiency === 'insufficient' || ai.relevance === 'none' ? (
                        showOverrideForm === link.link_id ? (
                          <div className="flex w-full flex-col gap-2 sm:flex-row">
                            <input
                              className={inputClassName}
                              placeholder="覆写理由（必填：为何仍认为充分）"
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!overrideReason.trim() || confirmingId === link.link_id}
                              onClick={() => void handleConfirm(link.link_id, 'override_accept')}
                            >
                              仍标记充分
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowOverrideForm(link.link_id)}
                          >
                            仍标记充分…
                          </Button>
                        )
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={confirmingId === link.link_id}
                          onClick={() => void handleConfirm(link.link_id, 'override_reject')}
                        >
                          仍不充分
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">尚未附上支撑材料</p>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-[#FEF2F2] px-3 py-2 text-xs text-reject">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {showForm ? (
          <form className="space-y-3 rounded-md border border-gray-200 bg-white p-3" onSubmit={handleAttach}>
            <div className="space-y-1.5">
              <Label>证据来源类型</Label>
              <select
                className={inputClassName}
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
                disabled={submitting}
              >
                {EVIDENCE_SOURCE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>证据标题</Label>
              <input className={inputClassName} value={title} onChange={(e) => setTitle(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label>适用 SKU（逗号分隔，用于结构化预筛）</Label>
              <input className={inputClassName} value={scopeSkus} onChange={(e) => setScopeSkus(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label>证据文件（PDF 需有可选文字层）</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={EVIDENCE_FILE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  applySelectedFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
              <div
                role="button"
                tabIndex={submitting ? -1 : 0}
                aria-label="拖拽文件到此处或点击选择"
                aria-disabled={submitting}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => {
                  if (!submitting) fileInputRef.current?.click();
                }}
                onKeyDown={(event) => {
                  if (submitting) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors',
                  submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                  dragActive
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-300 bg-gray-50/60 hover:border-gray-400 hover:bg-gray-50',
                )}
              >
                <Upload
                  className={cn('h-5 w-5', dragActive ? 'text-blue-600' : 'text-ink/50')}
                />
                <p className={cn('text-xs leading-relaxed', dragActive ? 'text-blue-800' : 'text-muted-foreground')}>
                  {dragActive ? '释放以上传文件' : '拖拽文件到此处或点击选择'}
                </p>
                <p className="text-[11px] text-gray-400">支持 PDF / TXT / MD</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Paperclip className="h-3.5 w-3.5" /> 选择文件
                </Button>
                {file && (
                  <p className="max-w-full truncate text-xs font-medium text-ink" title={file.name}>
                    已选：{file.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="brand" size="sm" disabled={submitting}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '上传并 AI 判断'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>取消</Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Paperclip className="h-3.5 w-3.5" /> 附上证据
          </Button>
        )}
      </div>
    </div>
  );
}

export function FindingEvidencePanel({
  reviewId,
  findings,
  adText,
  countryId,
  categoryId,
  productSku,
}: FindingEvidencePanelProps) {
  const evidenceFindings = findings.filter((f) =>
    supportsEvidenceAttachment(
      f.remediation_type as Parameters<typeof supportsEvidenceAttachment>[0],
      f.decision,
    ),
  );

  const evidenceGroups = groupFindingsByClaimAnchor(evidenceFindings);

  if (evidenceGroups.length === 0) return null;

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-ink">
        第二步：补充证据
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">Evidence + AI Judgment</span>
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        同一原文片段（claim anchor）只展示一张上传卡；上传一次会同步到该片段下的全部相关 finding。系统将先做结构化预筛，再运行 AI 关联性/充分性判断。
      </p>
      <div className="space-y-3">
        {evidenceGroups.map((group) => (
          <FindingEvidenceItem
            key={group.groupKey}
            reviewId={reviewId}
            findings={group.findings}
            claimAnchor={group.claimAnchor}
            adText={adText}
            countryId={countryId}
            categoryId={categoryId}
            productSku={productSku}
          />
        ))}
      </div>
    </section>
  );
}
