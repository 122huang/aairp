import { caseCorpusPlugin } from './corpus/case-corpus.plugin.js';
import { writeCorpusManifest } from './platform/knowledge-platform.js';
import type { CorpusManifest } from './platform/corpus-sdk.js';

export type CaseCorpusManifest = CorpusManifest & {
  by_cluster: Record<string, number>;
  by_status: Record<string, number>;
};

function mapManifest(manifest: CorpusManifest): CaseCorpusManifest {
  const dimensions = (manifest.dimensions ?? {}) as {
    by_cluster?: Record<string, number>;
    by_status?: Record<string, number>;
  };
  return {
    ...manifest,
    by_cluster: dimensions.by_cluster ?? {},
    by_status: dimensions.by_status ?? {},
  };
}

export function buildCaseCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): CaseCorpusManifest {
  const now = options?.now ?? new Date();
  const bundle = caseCorpusPlugin.load(options?.customRoot);
  return mapManifest(caseCorpusPlugin.buildManifest(bundle.entries, bundle.root, now));
}

export function writeCaseCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): CaseCorpusManifest {
  return mapManifest(writeCorpusManifest(caseCorpusPlugin, options));
}
