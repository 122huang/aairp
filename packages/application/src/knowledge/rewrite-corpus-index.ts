import { rewriteCorpusPlugin } from './corpus/rewrite-corpus.plugin.js';
import { writeCorpusManifest } from './platform/knowledge-platform.js';
import type { CorpusManifest } from './platform/corpus-sdk.js';
import type { RewriteStrategyType } from './rewrite-corpus.js';

export type RewriteCorpusManifest = CorpusManifest & {
  by_strategy: Record<string, number>;
  by_status: Record<string, number>;
};

function mapManifest(manifest: CorpusManifest): RewriteCorpusManifest {
  const dimensions = (manifest.dimensions ?? {}) as {
    by_strategy?: Record<string, number>;
    by_status?: Record<string, number>;
  };
  return {
    ...manifest,
    by_strategy: dimensions.by_strategy ?? {},
    by_status: dimensions.by_status ?? {},
  };
}

export function buildRewriteCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): RewriteCorpusManifest {
  const now = options?.now ?? new Date();
  const bundle = rewriteCorpusPlugin.load(options?.customRoot);
  return mapManifest(rewriteCorpusPlugin.buildManifest(bundle.entries, bundle.root, now));
}

export function writeRewriteCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): RewriteCorpusManifest {
  const manifest = writeCorpusManifest(rewriteCorpusPlugin, options);
  return mapManifest(manifest);
}

export type { RewriteStrategyType };
