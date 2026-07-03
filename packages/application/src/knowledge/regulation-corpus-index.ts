import { regulationCorpusPlugin } from './corpus/regulation-corpus.plugin.js';
import { writeCorpusManifest } from './platform/knowledge-platform.js';
import type { CorpusManifest } from './platform/corpus-sdk.js';
import type { RegulationCategoryName } from './regulation-corpus.js';
import { REGULATION_CORPUS_COUNTRY_CODES } from './regulation-corpus.js';

export type RegulationCorpusManifest = CorpusManifest & {
  countries: typeof REGULATION_CORPUS_COUNTRY_CODES;
  categories: RegulationCategoryName[];
  by_country: Record<string, number>;
  by_category: Record<string, number>;
};

function mapManifest(manifest: CorpusManifest): RegulationCorpusManifest {
  const dimensions = (manifest.dimensions ?? {}) as {
    by_country?: Record<string, number>;
    by_category?: Record<string, number>;
  };
  const metadata = (manifest.metadata ?? {}) as {
    countries?: typeof REGULATION_CORPUS_COUNTRY_CODES;
    categories?: RegulationCategoryName[];
  };
  return {
    ...manifest,
    countries: metadata.countries ?? [...REGULATION_CORPUS_COUNTRY_CODES],
    categories: metadata.categories ?? [],
    by_country: dimensions.by_country ?? {},
    by_category: dimensions.by_category ?? {},
  };
}

export function buildRegulationCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): RegulationCorpusManifest {
  const now = options?.now ?? new Date();
  const bundle = regulationCorpusPlugin.load(options?.customRoot);
  return mapManifest(regulationCorpusPlugin.buildManifest(bundle.entries, bundle.root, now));
}

export function writeRegulationCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): RegulationCorpusManifest {
  const manifest = writeCorpusManifest(regulationCorpusPlugin, options);
  return mapManifest(manifest);
}
