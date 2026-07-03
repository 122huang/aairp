import type { ModuleFinding } from './finding-types.js';
import type { ImageSliceManifest } from './image-slice.js';

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
  manifests: ImageSliceManifest[];
  findings: VisionFinding[];
  hasBlocker: boolean;
  skipped: boolean;
  skipReason?: 'VISION_MODE_OFF' | 'NO_IMAGES';
  extractedText?: string[];
  evaluatedAt: string;
};

export function visionFindingHasBlocker(findings: VisionFinding[]): boolean {
  return findings.some(
    (finding) => finding.severity === 'BLOCKER' && finding.decision === 'FAIL',
  );
}
