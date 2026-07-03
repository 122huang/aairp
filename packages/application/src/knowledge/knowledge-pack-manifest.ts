import {
  assembleAndWriteDraft,
  markPackValidated,
  releaseKnowledgePack,
  writeKnowledgePackDraft,
} from './knowledge-pack-release.js';
import { assembleKnowledgePackDraft } from './knowledge-pack-assembler.js';
import { validateKnowledgePack } from './knowledge-pack-validator.js';
import {
  loadKnowledgePackDraft,
  loadKnowledgePackManifest,
  packFingerprint,
  packVersion,
  isKnowledgePackV2,
  corpusFingerprints,
  resolveKnowledgePackManifestPath,
  type KnowledgePackLegacy,
  type KnowledgePackManifest,
  type KnowledgePackV2,
} from './knowledge-pack.js';

export type { KnowledgePackLegacy, KnowledgePackManifest, KnowledgePackV2 };
export {
  loadKnowledgePackManifest,
  loadKnowledgePackDraft,
  packVersion,
  packFingerprint,
  isKnowledgePackV2,
  corpusFingerprints,
  resolveKnowledgePackManifestPath,
  assembleKnowledgePackDraft,
  validateKnowledgePack,
  releaseKnowledgePack,
  assembleAndWriteDraft,
};

export function buildKnowledgePackManifest(): KnowledgePackV2 {
  return assembleKnowledgePackDraft();
}

export function writeKnowledgePackManifest(): KnowledgePackV2 {
  return assembleAndWriteDraft();
}

export function validateAndMarkDraft(options?: { now?: Date }): {
  pack: KnowledgePackV2;
  validation: ReturnType<typeof validateKnowledgePack>;
} {
  const now = options?.now ?? new Date();
  const draft = loadKnowledgePackDraft() ?? assembleAndWriteDraft({ now });
  const validation = validateKnowledgePack(draft, { now });
  const pack = validation.passed ? markPackValidated(draft) : writeKnowledgePackDraft(draft);
  return { pack, validation };
}
