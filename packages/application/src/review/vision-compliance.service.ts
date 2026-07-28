import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
  ImageContentBlockHint,
  ImageSlice,
  ImageSliceManifest,
  ReviewContext,
  VisionDiscoveryResult,
  VisionFinding,
  VisionScanDimension,
  VisionSuggestedAction,
} from '@aairp/shared-kernel';
import { visionFindingHasBlocker } from '@aairp/shared-kernel';
import type { ILlmGateway } from './stub-llm.gateway.types.js';
import { createDefaultVisionLlmGateway, resolveVisionLlmMode } from './vision-llm.gateway.js';
import {
  parseVisionResponseContent,
  type VisionFindingPayload,
} from './vision-response.parser.js';
import { ImageSlicePlannerService } from './image-slice-planner.service.js';
import {
  createSliceThumbnailDataUrl,
  cropImageDataUrlForSlice,
  probeImageDimensions,
} from './image-slice-crop.js';
import { detectContentBlocksFromImage } from './image-section-segmenter.js';
import { FieldExtractService } from './field-extract.service.js';
import { ConsistencyCompareService } from './consistency-compare.service.js';
import {
  enhanceVisionSliceImage,
  enhanceVisionSourceImages,
} from './vision-image-prepare.js';

export type VisionComplianceConfig = {
  promptPath?: string;
  promptTemplate?: string;
  promptPackVersion?: string;
  stubResponsePath?: string;
  llmGateway?: ILlmGateway | null;
  slicePlanner?: ImageSlicePlannerService;
  fieldExtractService?: FieldExtractService;
  consistencyCompareService?: ConsistencyCompareService;
  cropImageForSlice?: (imageUrl: string, slice: ImageSlice) => Promise<string>;
  createSliceThumbnail?: (imageUrl: string, slice: ImageSlice) => Promise<string>;
  disableHeuristicSegmentation?: boolean;
  /** Skip upscale/sharpen preprocess (tests / already-enhanced inputs). */
  disableImageEnhance?: boolean;
  now?: () => Date;
  createFindingId?: () => string;
  readTextFile?: (path: string) => string;
};

const defaultPromptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/vision.prompt.txt',
);

const LONG_IMAGE_ASPECT_RATIO = 2;

function mapSuggestedAction(action: string): VisionSuggestedAction {
  if (action === 'REJECT') {
    return 'REJECT';
  }
  if (action === 'WARN') {
    return 'WARN';
  }
  return 'MANUAL_REVIEW';
}

function mapFindingDecision(
  severity: VisionFindingPayload['severity'],
  suggestedAction: VisionSuggestedAction,
): VisionFinding['decision'] {
  if (severity === 'BLOCKER' && suggestedAction === 'REJECT') {
    return 'FAIL';
  }
  return suggestedAction === 'MANUAL_REVIEW' ? 'REVIEW' : 'WARN';
}

function mapScanDimension(value?: string): VisionScanDimension | undefined {
  if (
    value === 'panel_language' ||
    value === 'certification_badge' ||
    value === 'scene_content' ||
    value === 'visible_text'
  ) {
    return value;
  }
  return undefined;
}

function createVisionFinding(
  config: VisionComplianceConfig,
  promptPackVersion: string,
  slice: ImageSlice,
  payload: VisionFindingPayload,
): VisionFinding {
  const suggestedAction = mapSuggestedAction(payload.suggested_action);
  const findingId = `vf_${(config.createFindingId ?? randomUUID)()}`;

  return {
    module: 'VISION',
    findingId,
    severity: payload.severity,
    decision: mapFindingDecision(payload.severity, suggestedAction),
    refType: 'VISION_RISK',
    refId: payload.risk_type,
    refVersionId: `${promptPackVersion}-${payload.risk_type}-v1`,
    summary: payload.description,
    confidence: payload.confidence,
    sliceId: slice.sliceId,
    evaluationDetail: {
      riskType: payload.risk_type,
      suggestedAction,
      ...(payload.scan_dimension
        ? { scanDimension: mapScanDimension(payload.scan_dimension) }
        : {}),
      ...(payload.evidence_spans
        ? {
            evidenceSpans: payload.evidence_spans.map((span) => ({
              field: span.field,
              ...(span.slice_index !== undefined ? { sliceIndex: span.slice_index } : {}),
              ...(span.region_description
                ? { regionDescription: span.region_description }
                : {}),
              ...(span.start !== undefined ? { start: span.start } : {}),
              ...(span.end !== undefined ? { end: span.end } : {}),
              ...(span.text ? { text: span.text } : {}),
            })),
          }
        : {}),
      ...(payload.related_modules_checked
        ? { relatedModulesChecked: payload.related_modules_checked }
        : {}),
      ...(payload.cited_rule_refs ? { citedRuleRefs: payload.cited_rule_refs } : {}),
    },
  };
}

export function resolveVisionAdTextReference(context: ReviewContext): string {
  const adText = context.normalizedContent.text.trim();
  if (adText) {
    return adText;
  }

  const countryId = context.dimensions.countryId;
  return `Target market is ${countryId}. The primary language should be the local language or English. Flag any non-English, non-local-language text visible on product panels or UI elements.`;
}

export function describeVisionImageReference(imageUrl: string): string {
  if (imageUrl.startsWith('data:image/')) {
    return 'attached-inline-slice';
  }
  return imageUrl;
}

export function estimateVisionInputTokens(prompt: string, imageUrl?: string): number {
  let estimate = Math.ceil(prompt.length / 4);
  if (imageUrl?.startsWith('data:image/')) {
    const base64Payload = imageUrl.split(',')[1] ?? '';
    estimate += Math.ceil(base64Payload.length / 3);
  }
  return estimate;
}

export function renderVisionPrompt(
  template: string,
  context: ReviewContext,
  slice: ImageSlice,
): string {
  const sourceImageUrl = context.normalizedContent.imageUrls[slice.sourceImageIndex] ?? '';
  return template
    .replaceAll('{country_id}', context.dimensions.countryId)
    .replaceAll('{platform_id}', context.dimensions.platformId)
    .replaceAll('{category_id}', context.dimensions.categoryId)
    .replaceAll('{source_image_index}', String(slice.sourceImageIndex))
    .replaceAll('{slice_index}', String(slice.sliceIndex))
    .replaceAll('{slice_type}', slice.sliceType)
    .replaceAll('{slice_y_start}', String(slice.yStart))
    .replaceAll('{slice_y_end}', String(slice.yEnd))
    .replaceAll('{ad_text}', resolveVisionAdTextReference(context))
    .replaceAll('{ocr_text}', context.normalizedContent.ocrText ?? '')
    .replaceAll('{image_url}', describeVisionImageReference(sourceImageUrl));
}

function isLongImage(dimensions: { width: number; height: number }): boolean {
  return dimensions.width > 0 && dimensions.height / dimensions.width >= LONG_IMAGE_ASPECT_RATIO;
}

async function resolveContentBlockHints(
  context: ReviewContext,
  imageUrls: string[],
  imageDimensions: Array<{ width: number; height: number } | undefined>,
  config: VisionComplianceConfig,
): Promise<ImageContentBlockHint[][] | undefined> {
  if (context.normalizedContent.imageContentBlockHints?.length) {
    return context.normalizedContent.imageContentBlockHints;
  }
  if (config.disableHeuristicSegmentation) {
    return undefined;
  }

  const hintsByImage: ImageContentBlockHint[][] = [];
  let anyDetected = false;

  for (let index = 0; index < imageUrls.length; index += 1) {
    const dimensions = imageDimensions[index];
    const imageUrl = imageUrls[index] ?? '';
    if (!dimensions || !isLongImage(dimensions)) {
      hintsByImage.push([]);
      continue;
    }
    const detected = await detectContentBlocksFromImage(imageUrl, {
      maxSegments: Number(process.env.VISION_MAX_SLICES_PER_IMAGE ?? 8),
    });
    if (detected?.length) {
      hintsByImage.push(detected);
      anyDetected = true;
    } else {
      hintsByImage.push([]);
    }
  }

  return anyDetected ? hintsByImage : undefined;
}

export class VisionComplianceService {
  private readonly slicePlanner: ImageSlicePlannerService;
  private readonly fieldExtractService: FieldExtractService;
  private readonly consistencyCompareService: ConsistencyCompareService;

  constructor(private readonly config: VisionComplianceConfig = {}) {
    this.slicePlanner = config.slicePlanner ?? new ImageSlicePlannerService();
    this.fieldExtractService = config.fieldExtractService ?? new FieldExtractService();
    this.consistencyCompareService =
      config.consistencyCompareService ?? new ConsistencyCompareService();
  }

  async discover(context: ReviewContext): Promise<VisionDiscoveryResult> {
    const evaluatedAt = (this.config.now ?? (() => new Date()))().toISOString();
    const mode = resolveVisionLlmMode();

    if (mode === 'off') {
      return Promise.resolve({
        reviewId: context.reviewId,
        promptPackVersion: this.config.promptPackVersion ?? 'demo-vision-1.0.0',
        manifests: [],
        findings: [],
        hasBlocker: false,
        skipped: true,
        skipReason: 'VISION_MODE_OFF',
        evaluatedAt,
      });
    }

    const imageUrls = context.normalizedContent.imageUrls;
    if (imageUrls.length === 0) {
      return Promise.resolve({
        reviewId: context.reviewId,
        promptPackVersion: this.config.promptPackVersion ?? 'demo-vision-1.0.0',
        manifests: [],
        findings: [],
        hasBlocker: false,
        skipped: true,
        skipReason: 'NO_IMAGES',
        evaluatedAt,
      });
    }

    const readTextFile = this.config.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
    const promptPath = this.config.promptPath ?? defaultPromptPath;
    const promptTemplate = this.config.promptTemplate ?? readTextFile(promptPath);
    const gateway =
      this.config.llmGateway === undefined
        ? createDefaultVisionLlmGateway({
            stubResponsePath: this.config.stubResponsePath,
            readTextFile,
          })
        : this.config.llmGateway;

    if (!gateway) {
      return Promise.resolve({
        reviewId: context.reviewId,
        promptPackVersion: this.config.promptPackVersion ?? 'demo-vision-1.0.0',
        manifests: [],
        findings: [],
        hasBlocker: false,
        skipped: true,
        skipReason: 'VISION_MODE_OFF',
        evaluatedAt,
      });
    }

    // Narrow/chat-compressed sources get a capped full-canvas enhance for segment/plan.
    // Every slice crop is enhanced again before the LLM (cheap, high-ROI for small text).
    const probed = await this.resolveImageDimensions(context, imageUrls);
    const needsFullEnhance =
      !this.config.disableImageEnhance &&
      probed.some((dim) => dim !== undefined && dim.width > 0 && dim.width < 600);

    const enhanced = this.config.disableImageEnhance
      ? imageUrls.map(() => undefined)
      : needsFullEnhance
        ? await enhanceVisionSourceImages(imageUrls)
        : imageUrls.map(() => undefined);

    const workingUrls = imageUrls.map((url, index) => enhanced[index]?.dataUrl ?? url);
    const imagePreprocess = enhanced
      .map((item, sourceImageIndex) =>
        item
          ? {
              sourceImageIndex,
              upscaled: item.upscaled,
              sharpened: item.sharpened,
              sourceWidth: item.sourceWidth,
              sourceHeight: item.sourceHeight,
              width: item.width,
              height: item.height,
            }
          : undefined,
      )
      .filter((item): item is NonNullable<typeof item> => item !== undefined);

    const workingContext: ReviewContext = {
      ...context,
      normalizedContent: {
        ...context.normalizedContent,
        imageUrls: workingUrls,
        imageDimensions: workingUrls.map((_, index) => {
          const prep = enhanced[index];
          if (prep) {
            return { width: prep.width, height: prep.height };
          }
          return probed[index] ?? context.normalizedContent.imageDimensions?.[index];
        }),
      },
    };

    const imageDimensions = await this.resolveImageDimensions(workingContext, workingUrls);
    const contentBlockHints = await resolveContentBlockHints(
      workingContext,
      workingUrls,
      imageDimensions,
      this.config,
    );

    const manifests = this.slicePlanner.planFromNormalizedContent({
      imageUrls: workingUrls,
      imageDimensions,
      imageContentBlockHints: contentBlockHints,
      sliceManifestOverrides: context.normalizedContent.sliceManifestOverrides,
    });

    const result = await this.evaluateManifests(
      workingContext,
      manifests,
      promptTemplate,
      gateway,
      evaluatedAt,
    );
    return {
      ...result,
      ...(imagePreprocess.length > 0 ? { imagePreprocess } : {}),
    };
  }

  private async resolveImageDimensions(
    context: ReviewContext,
    imageUrls: string[],
  ): Promise<Array<{ width: number; height: number } | undefined>> {
    return Promise.all(
      imageUrls.map(async (url, index) => {
        const known = context.normalizedContent.imageDimensions?.[index];
        if (known) {
          return known;
        }
        return probeImageDimensions(url);
      }),
    );
  }

  private async evaluateManifests(
    context: ReviewContext,
    manifests: ImageSliceManifest[],
    promptTemplate: string,
    gateway: ILlmGateway,
    evaluatedAt: string,
  ): Promise<VisionDiscoveryResult> {
    const findings: VisionFinding[] = [];
    const extractedText: string[] = [];
    const extractedTextBySlice: Record<string, string[]> = {};
    const sliceThumbnails: Record<string, string> = {};
    const allSlices: ImageSlice[] = [];
    const seenFindingKeys = new Set<string>();
    let promptPackVersion = this.config.promptPackVersion ?? 'demo-vision-1.0.0';
    let model: string | undefined;
    const cropImageForSlice = this.config.cropImageForSlice ?? cropImageDataUrlForSlice;
    const createSliceThumbnail =
      this.config.createSliceThumbnail ?? createSliceThumbnailDataUrl;

    for (const manifest of manifests) {
      const sliceResults = await Promise.all(
        manifest.slices.map(async (slice) => {
          allSlices.push(slice);
          const sourceImageUrl = context.normalizedContent.imageUrls[slice.sourceImageIndex] ?? '';
          const croppedImageUrl = await cropImageForSlice(sourceImageUrl, slice);
          const enhancedCrop = this.config.disableImageEnhance
            ? croppedImageUrl
            : await enhanceVisionSliceImage(croppedImageUrl);
          const thumbnail = await createSliceThumbnail(sourceImageUrl, slice);
          if (thumbnail) {
            sliceThumbnails[slice.sliceId] = thumbnail;
          }
          const prompt = renderVisionPrompt(promptTemplate, context, slice);
          const tokensEstimate = estimateVisionInputTokens(prompt, enhancedCrop);

          console.info(
            `vision slice call: sliceIndex=${slice.sliceIndex}, tokensEstimate=${tokensEstimate}, croppedBytes=${enhancedCrop.startsWith('data:image/') ? (enhancedCrop.split(',')[1]?.length ?? 0) : 0}`,
          );

          const response = await gateway.complete(prompt, { imageUrl: enhancedCrop });
          const tokensActual = response.usage?.total_tokens;
          if (tokensActual !== undefined) {
            console.info(
              `vision slice call: sliceIndex=${slice.sliceIndex}, tokensActual=${tokensActual}`,
            );
          }

          return {
            slice,
            parsed: parseVisionResponseContent(response.content),
            model: response.model,
          };
        }),
      );

      for (const { slice, parsed, model: sliceModel } of sliceResults) {
        if (!model && sliceModel) {
          model = sliceModel;
        }
        if (parsed.prompt_pack_version) {
          promptPackVersion = parsed.prompt_pack_version;
        }
        if (parsed.extracted_text?.length) {
          extractedText.push(...parsed.extracted_text);
          extractedTextBySlice[slice.sliceId] = parsed.extracted_text;
        }
        for (const payload of parsed.findings) {
          const scanDimension = payload.scan_dimension ?? '';
          const dedupeKey = `${slice.sourceImageIndex}:${payload.risk_type}:${scanDimension}`;
          if (seenFindingKeys.has(dedupeKey)) {
            continue;
          }
          seenFindingKeys.add(dedupeKey);
          findings.push(createVisionFinding(this.config, promptPackVersion, slice, payload));
        }
      }
    }

    const fieldExtracts = this.fieldExtractService.extractFromSliceTexts(
      allSlices.map((slice) => ({
        sliceId: slice.sliceId,
        sourceImageIndex: slice.sourceImageIndex,
        sliceIndex: slice.sliceIndex,
        texts: extractedTextBySlice[slice.sliceId] ?? [],
      })),
    );
    const consistencyResult = await this.consistencyCompareService.compareWithOptionalLlmAssist({
      reviewId: context.reviewId,
      fieldExtracts,
      countryId: context.dimensions.countryId,
      platformId: context.dimensions.platformId,
      categoryId: context.dimensions.categoryId,
    });

    return {
      reviewId: context.reviewId,
      promptPackVersion,
      ...(model ? { model } : {}),
      manifests,
      findings,
      hasBlocker: visionFindingHasBlocker(findings),
      skipped: false,
      ...(extractedText.length > 0 ? { extractedText } : {}),
      ...(Object.keys(extractedTextBySlice).length > 0
        ? {
            extractedTextBySlice: Object.entries(extractedTextBySlice).map(([sliceId, texts]) => ({
              sliceId,
              texts,
            })),
          }
        : {}),
      ...(fieldExtracts.length > 0 ? { fieldExtracts } : {}),
      ...(consistencyResult.findings.length > 0
        ? { consistencyFindings: consistencyResult.findings }
        : {}),
      ...(Object.keys(sliceThumbnails).length > 0 ? { sliceThumbnails } : {}),
      evaluatedAt,
    };
  }
}
