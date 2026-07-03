import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  corpusFingerprints,
  isKnowledgePackV2,
  loadKnowledgePackDraft,
  loadKnowledgePackManifest,
  packFingerprint,
  repoRoot,
} from './knowledge-pack.js';

export const EVAL_BASELINE_REFERENCE = 'benchmark-v3-baseline-2026-06-30';

export type KnowledgeEvalLinkageStamp = {
  knowledge_pack_id: string | null;
  knowledge_pack_fingerprint: string | null;
  corpus_fingerprints: Record<string, string> | null;
  evaluation_reference: string;
  regression_baseline_report: string;
};

export function resolveRegressionBaselineReportPath(): string {
  return 'reports/eval-v3-2026-07-01T05-51-15-747Z.json';
}

function resolveActivePack() {
  const released = loadKnowledgePackManifest();
  if (released && isKnowledgePackV2(released) && released.release_status === 'released') {
    return { pack: released, knowledge_pack_id: released.knowledge_pack_id };
  }
  const draft = loadKnowledgePackDraft();
  if (draft) {
    return { pack: draft, knowledge_pack_id: draft.knowledge_pack_id };
  }
  if (released && isKnowledgePackV2(released)) {
    return { pack: released, knowledge_pack_id: released.knowledge_pack_id };
  }
  return { pack: null, knowledge_pack_id: null };
}

export function resolveKnowledgeEvalLinkageStamp(): KnowledgeEvalLinkageStamp {
  const { pack, knowledge_pack_id } = resolveActivePack();

  const evaluationRef =
    pack?.evaluation_linkage?.regression_baseline_ref ??
    (() => {
      try {
        const baseline = JSON.parse(
          readFileSync(join(repoRoot(), 'benchmark/benchmark-v3-baseline.json'), 'utf8'),
        ) as { baseline_id?: string };
        return baseline.baseline_id ?? EVAL_BASELINE_REFERENCE;
      } catch {
        return EVAL_BASELINE_REFERENCE;
      }
    })();

  return {
    knowledge_pack_id,
    knowledge_pack_fingerprint: pack ? packFingerprint(pack) : null,
    corpus_fingerprints: pack ? corpusFingerprints(pack) : null,
    evaluation_reference: evaluationRef,
    regression_baseline_report: resolveRegressionBaselineReportPath(),
  };
}
