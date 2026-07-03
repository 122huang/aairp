import { evidenceCorpusPlugin } from './corpus/evidence-corpus.plugin.js';
import { writeCorpusManifest } from './platform/knowledge-platform.js';
import type { CorpusManifest } from './platform/corpus-sdk.js';
import type { EvidenceCorpusStatus, EvidenceTypeKey } from './evidence-corpus.js';

export type EvidenceCorpusManifest = CorpusManifest & {
  by_type: Record<string, number>;
  by_status: Record<string, number>;
};

function mapManifest(manifest: CorpusManifest): EvidenceCorpusManifest {
  const dimensions = (manifest.dimensions ?? {}) as {
    by_type?: Record<string, number>;
    by_status?: Record<string, number>;
  };
  return {
    ...manifest,
    by_type: dimensions.by_type ?? {},
    by_status: dimensions.by_status ?? {},
  };
}

export function buildEvidenceCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): EvidenceCorpusManifest {
  const now = options?.now ?? new Date();
  const bundle = evidenceCorpusPlugin.load(options?.customRoot);
  return mapManifest(evidenceCorpusPlugin.buildManifest(bundle.entries, bundle.root, now));
}

export function writeEvidenceCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): EvidenceCorpusManifest {
  const manifest = writeCorpusManifest(evidenceCorpusPlugin, options);
  return mapManifest(manifest);
}

export type { EvidenceCorpusStatus, EvidenceTypeKey };
