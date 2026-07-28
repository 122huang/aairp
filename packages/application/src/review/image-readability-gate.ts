import { randomUUID } from 'node:crypto';
import type { ReviewContext, VisionDiscoveryResult, VisionFinding } from '@aairp/shared-kernel';
import { joinVisionExtractedText } from './content-matching.js';

/** Chat-compressed / thumbnail strips below this width are not compliance-auditable. */
export const MIN_READABLE_SOURCE_WIDTH = 200;
/** Combined ad + OCR + vision extract below this is treated as empty for image reviews. */
export const MIN_EFFECTIVE_TEXT_CHARS = 40;
/** Count of `[unreadable` markers that forces manual review. */
export const MIN_UNREADABLE_MARKERS = 2;

export type ImageReadabilityReason =
  | 'narrow_source'
  | 'insufficient_text'
  | 'unreadable_markers'
  | 'vision_unavailable';

export type ImageReadabilityAssessment = {
  triggered: boolean;
  reasons: ImageReadabilityReason[];
  effectiveTextChars: number;
  minSourceWidth?: number;
  unreadableMarkerCount: number;
  detail: string;
};

export type ImageReadabilityGateInput = {
  adText?: string;
  ocrText?: string;
  visionText?: string;
  extractedText?: string[];
  imageUrls: string[];
  imageDimensions?: Array<{ width: number; height: number } | undefined>;
  imagePreprocess?: Array<{ sourceWidth: number; sourceHeight: number }>;
  visionSkipped?: boolean;
};

function countUnreadableMarkers(text: string): number {
  return (text.match(/\[unreadable/gi) ?? []).length;
}

function resolveMinSourceWidth(input: ImageReadabilityGateInput): number | undefined {
  const widths: number[] = [];
  for (const prep of input.imagePreprocess ?? []) {
    if (prep.sourceWidth > 0) {
      widths.push(prep.sourceWidth);
    }
  }
  for (const dim of input.imageDimensions ?? []) {
    if (dim && dim.width > 0) {
      widths.push(dim.width);
    }
  }
  if (widths.length === 0) {
    return undefined;
  }
  return Math.min(...widths);
}

function resolveEffectiveText(input: ImageReadabilityGateInput): string {
  const parts = [
    input.adText?.trim() ?? '',
    input.ocrText?.trim() ?? '',
    input.visionText?.trim() ?? '',
    joinVisionExtractedText(input.extractedText) ?? '',
  ].filter((part) => part.length > 0);
  return parts.join('\n');
}

const REASON_LABELS: Record<ImageReadabilityReason, string> = {
  narrow_source: 'source image width below readable threshold',
  insufficient_text: 'ad/OCR/vision extract too short for claim review',
  unreadable_markers: 'vision reported multiple unreadable regions',
  vision_unavailable: 'vision skipped while image assets were submitted',
};

/**
 * Decide whether image-backed review must force MANUAL_REVIEW / REVIEW
 * instead of allowing a silent PASS on empty findings.
 */
export function assessImageReadability(input: ImageReadabilityGateInput): ImageReadabilityAssessment {
  if (input.imageUrls.length === 0) {
    return {
      triggered: false,
      reasons: [],
      effectiveTextChars: resolveEffectiveText(input).length,
      unreadableMarkerCount: 0,
      detail: '',
    };
  }

  const effectiveText = resolveEffectiveText(input);
  const effectiveTextChars = effectiveText.length;
  const minSourceWidth = resolveMinSourceWidth(input);
  const unreadableMarkerCount = countUnreadableMarkers(effectiveText);
  const reasons: ImageReadabilityReason[] = [];

  if (minSourceWidth !== undefined && minSourceWidth < MIN_READABLE_SOURCE_WIDTH) {
    reasons.push('narrow_source');
  }
  if (effectiveTextChars < MIN_EFFECTIVE_TEXT_CHARS) {
    reasons.push('insufficient_text');
  }
  if (unreadableMarkerCount >= MIN_UNREADABLE_MARKERS) {
    reasons.push('unreadable_markers');
  }
  if (input.visionSkipped && effectiveTextChars < MIN_EFFECTIVE_TEXT_CHARS) {
    reasons.push('vision_unavailable');
  }

  const triggered = reasons.length > 0;
  const detail = triggered
    ? `Visible text insufficient for reliable automated review (${reasons
        .map((reason) => REASON_LABELS[reason])
        .join('; ')}). Manual image review required — do not treat as compliance pass.`
    : '';

  return {
    triggered,
    reasons,
    effectiveTextChars,
    ...(minSourceWidth !== undefined ? { minSourceWidth } : {}),
    unreadableMarkerCount,
    detail,
  };
}

export function createInsufficientVisibleTextFinding(options: {
  detail: string;
  reasons: ImageReadabilityReason[];
  promptPackVersion?: string;
  createFindingId?: () => string;
}): VisionFinding {
  const promptPackVersion = options.promptPackVersion ?? 'demo-vision-1.0.0';
  const riskType = 'insufficient-visible-text';
  return {
    module: 'VISION',
    findingId: `vf_${(options.createFindingId ?? randomUUID)()}`,
    severity: 'MEDIUM',
    decision: 'REVIEW',
    refType: 'VISION_RISK',
    refId: riskType,
    refVersionId: `${promptPackVersion}-${riskType}-v1`,
    summary: options.detail,
    confidence: 0.9,
    evaluationDetail: {
      riskType,
      suggestedAction: 'MANUAL_REVIEW',
      scanDimension: 'visible_text',
      evidenceSpans: [
        {
          field: 'image',
          regionDescription: 'image readability gate',
          text: options.reasons.join(','),
        },
      ],
      ...(options.reasons.includes('unreadable_markers')
        ? { unreadableRegions: ['multiple-unreadable-markers'] }
        : {}),
    },
  };
}

/**
 * Attach an insufficient-visible-text VISION finding when the gate triggers.
 * Synthesizes a minimal VisionDiscoveryResult when vision was not run.
 */
export function applyImageReadabilityGate(
  context: ReviewContext,
  visionResult: VisionDiscoveryResult | undefined,
  options: { createFindingId?: () => string; now?: () => Date } = {},
): VisionDiscoveryResult | undefined {
  const imageUrls = context.normalizedContent.imageUrls;
  if (imageUrls.length === 0) {
    return visionResult;
  }

  const assessment = assessImageReadability({
    adText: context.normalizedContent.text,
    ocrText: context.normalizedContent.ocrText,
    visionText: context.normalizedContent.visionText,
    extractedText: visionResult?.extractedText,
    imageUrls,
    imageDimensions: context.normalizedContent.imageDimensions,
    imagePreprocess: visionResult?.imagePreprocess,
    visionSkipped: visionResult?.skipped === true || visionResult === undefined,
  });

  if (!assessment.triggered) {
    return visionResult;
  }

  if (visionResult?.findings.some((finding) => finding.refId === 'insufficient-visible-text')) {
    return visionResult;
  }

  const finding = createInsufficientVisibleTextFinding({
    detail: assessment.detail,
    reasons: assessment.reasons,
    promptPackVersion: visionResult?.promptPackVersion,
    createFindingId: options.createFindingId,
  });

  if (!visionResult) {
    return {
      reviewId: context.reviewId,
      promptPackVersion: 'demo-vision-1.0.0',
      manifests: [],
      findings: [finding],
      hasBlocker: false,
      skipped: true,
      skipReason: 'VISION_MODE_OFF',
      evaluatedAt: (options.now ?? (() => new Date()))().toISOString(),
    };
  }

  return {
    ...visionResult,
    findings: [...visionResult.findings, finding],
  };
}
