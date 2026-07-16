import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
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
import { cropImageDataUrlForSlice, probeImageDimensions } from './image-slice-crop.js';

export type VisionComplianceConfig = {
  promptPath?: string;
  promptTemplate?: string;
  promptPackVersion?: string;
  stubResponsePath?: string;
  llmGateway?: ILlmGateway | null;
  slicePlanner?: ImageSlicePlannerService;
  cropImageForSlice?: (imageUrl: string, slice: ImageSlice) => Promise<string>;
  now?: () => Date;
  createFindingId?: () => string;
  readTextFile?: (path: string) => string;
};

const defaultPromptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/vision.prompt.txt',
);

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

export class VisionComplianceService {
  private readonly slicePlanner: ImageSlicePlannerService;

  constructor(private readonly config: VisionComplianceConfig = {}) {
    this.slicePlanner = config.slicePlanner ?? new ImageSlicePlannerService();
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

    const imageDimensions = await this.resolveImageDimensions(context, imageUrls);

    const manifests = this.slicePlanner.planFromNormalizedContent({
      imageUrls,
      imageDimensions,
      imageContentBlockHints: context.normalizedContent.imageContentBlockHints,
      sliceManifestOverrides: context.normalizedContent.sliceManifestOverrides,
    });

    return this.evaluateManifests(context, manifests, promptTemplate, gateway, evaluatedAt);
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
    const seenFindingKeys = new Set<string>();
    let promptPackVersion = this.config.promptPackVersion ?? 'demo-vision-1.0.0';
    let model: string | undefined;
    const cropImageForSlice = this.config.cropImageForSlice ?? cropImageDataUrlForSlice;

    for (const manifest of manifests) {
      const sliceResults = await Promise.all(
        manifest.slices.map(async (slice) => {
          const sourceImageUrl = context.normalizedContent.imageUrls[slice.sourceImageIndex] ?? '';
          const croppedImageUrl = await cropImageForSlice(sourceImageUrl, slice);
          const prompt = renderVisionPrompt(promptTemplate, context, slice);
          const tokensEstimate = estimateVisionInputTokens(prompt, croppedImageUrl);

          console.info(
            `vision slice call: sliceIndex=${slice.sliceIndex}, tokensEstimate=${tokensEstimate}, croppedBytes=${croppedImageUrl.startsWith('data:image/') ? (croppedImageUrl.split(',')[1]?.length ?? 0) : 0}`,
          );

          const response = await gateway.complete(prompt, { imageUrl: croppedImageUrl });
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
        if (parsed.extracted_text) {
          extractedText.push(...parsed.extracted_text);
        }
        for (const payload of parsed.findings) {
          const dedupeKey = `${slice.sourceImageIndex}:${slice.sliceIndex}:${payload.risk_type}`;
          if (seenFindingKeys.has(dedupeKey)) {
            continue;
          }
          seenFindingKeys.add(dedupeKey);
          findings.push(createVisionFinding(this.config, promptPackVersion, slice, payload));
        }
      }
    }

    return {
      reviewId: context.reviewId,
      promptPackVersion,
      ...(model ? { model } : {}),
      manifests,
      findings,
      hasBlocker: visionFindingHasBlocker(findings),
      skipped: false,
      ...(extractedText.length > 0 ? { extractedText } : {}),
      evaluatedAt,
    };
  }
}
