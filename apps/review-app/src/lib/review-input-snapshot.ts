export type FileFingerprint = {
  name: string;
  size: number;
  lastModified: number;
};

/** Material fields that enter POST /demo/review for single-copy review. */
export type ReviewInputSnapshot = {
  countryId: string;
  categoryId: string;
  adType: string;
  productSku: string;
  copy: string;
  images: FileFingerprint[];
  evidence: FileFingerprint[];
  evidenceSourceType: string;
};

export type FileLike = Pick<File, 'name' | 'size' | 'lastModified'>;

export function fingerprintFile(file: FileLike): FileFingerprint {
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
  };
}

export const EVIDENCE_LIST_MAX_FILES = 5;

export type EvidenceListAction<T> =
  | { type: 'add'; files: T[] }
  | { type: 'remove'; index: number }
  | { type: 'replace'; files: T[] }
  | { type: 'clear' };

/** Latest files after add/remove/replace/clear. Used so Submit does not read a stale render closure. */
export function applyEvidenceListAction<T>(
  current: readonly T[],
  action: EvidenceListAction<T>,
  maxFiles = EVIDENCE_LIST_MAX_FILES,
): T[] {
  switch (action.type) {
    case 'add':
      return [...current, ...action.files].slice(0, maxFiles);
    case 'remove':
      return current.filter((_, index) => index !== action.index);
    case 'replace':
      return action.files.slice(0, maxFiles);
    case 'clear':
      return [];
  }
}

export type ReviewMaterialInput = {
  countryId: string;
  categoryId: string;
  adType: string;
  productSku: string;
  copy: string;
  images: FileLike[];
  evidence: FileLike[];
  evidenceSourceType: string;
};

export function captureReviewInputSnapshot(input: ReviewMaterialInput): ReviewInputSnapshot {
  const evidence = input.evidence.map(fingerprintFile);
  return {
    countryId: input.countryId,
    categoryId: input.categoryId,
    adType: input.adType,
    productSku: input.productSku.trim(),
    copy: input.copy.trim(),
    images: input.images.map(fingerprintFile),
    evidence,
    evidenceSourceType: evidence.length > 0 ? input.evidenceSourceType : '',
  };
}

export function reviewInputSnapshotId(snapshot: ReviewInputSnapshot): string {
  return hashString(JSON.stringify(snapshot));
}

export function isReviewInputSnapshotEqual(
  left: ReviewInputSnapshot,
  right: ReviewInputSnapshot,
): boolean {
  return reviewInputSnapshotId(left) === reviewInputSnapshotId(right);
}

export function isBoundReviewResultStale(
  current: ReviewInputSnapshot,
  boundSnapshot: ReviewInputSnapshot | null,
): boolean {
  if (!boundSnapshot) return false;
  return !isReviewInputSnapshotEqual(current, boundSnapshot);
}

export function shouldAcceptReviewResponse(input: {
  generation: number;
  latestGeneration: number;
  aborted: boolean;
}): boolean {
  return !input.aborted && input.generation === input.latestGeneration;
}

export function reviewSubmitLogFields(
  snapshot: ReviewInputSnapshot,
  requestId: string,
): Record<string, string | number | string[]> {
  return {
    request_id: requestId,
    snapshot_id: reviewInputSnapshotId(snapshot),
    country: snapshot.countryId,
    category: snapshot.categoryId,
    evidence_count: snapshot.evidence.length,
    evidence_filenames: snapshot.evidence.map((file) => file.name),
    image_count: snapshot.images.length,
    text_fingerprint: hashString(snapshot.copy),
  };
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
