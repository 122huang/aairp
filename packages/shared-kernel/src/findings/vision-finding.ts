import type { ModuleFinding } from './finding-types.js';
import type { ImageSliceManifest } from './image-slice.js';
import type {
  AssetFieldExtract,
  ConsistencyFinding,
} from './consistency-finding.js';

/** Image-grounded evidence span; supports slice index and region description for visual findings. */
export type ImageEvidenceSpan = {
  field: string;
  sliceIndex?: number;
  regionDescription?: string;
  start?: number;
  end?: number;
  text?: string;
};

export type VisionScanDimension =
  | 'panel_language'
  | 'certification_badge'
  | 'scene_content'
  | 'visible_text';

export type VisionSuggestedAction = 'WARN' | 'MANUAL_REVIEW' | 'REJECT';

export type VisionEvaluationDetail = {
  riskType: string;
  suggestedAction: VisionSuggestedAction;
  scanDimension?: VisionScanDimension;
  evidenceSpans?: ImageEvidenceSpan[];
  relatedModulesChecked?: string[];
  citedRuleRefs?: string[];
  languagesDetected?: string[];
  unreadableRegions?: string[];
};

export type VisionFinding = ModuleFinding & {
  module: 'VISION';
  refType: 'VISION_RISK';
  sliceId?: string;
  evaluationDetail?: VisionEvaluationDetail;
};

export type VisionDiscoveryResult = {
  reviewId: string;
  promptPackVersion: string;
  /** Concrete vision model id returned by the LLM gateway for slice calls. */
  model?: string;
  manifests: ImageSliceManifest[];
  findings: VisionFinding[];
  hasBlocker: boolean;
  skipped: boolean;
  skipReason?: 'VISION_MODE_OFF' | 'NO_IMAGES';
  extractedText?: string[];
  /** Per-slice OCR/vision text used by the consistency branch. */
  extractedTextBySlice?: Array<{ sliceId: string; texts: string[] }>;
  fieldExtracts?: AssetFieldExtract[];
  consistencyFindings?: ConsistencyFinding[];
  /** sliceId -> JPEG data URL thumbnail for report UI. */
  sliceThumbnails?: Record<string, string>;
  /** Per-source preprocess stats (upscale/sharpen) applied before slicing. */
  imagePreprocess?: Array<{
    sourceImageIndex: number;
    upscaled: boolean;
    sharpened: boolean;
    sourceWidth: number;
    sourceHeight: number;
    width: number;
    height: number;
  }>;
  evaluatedAt: string;
};

export function visionFindingHasBlocker(findings: VisionFinding[]): boolean {
  return findings.some(
    (finding) => finding.severity === 'BLOCKER' && finding.decision === 'FAIL',
  );
}
