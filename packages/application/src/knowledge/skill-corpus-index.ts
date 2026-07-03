import { skillCorpusPlugin } from './corpus/skill-corpus.plugin.js';
import { writeCorpusManifest } from './platform/knowledge-platform.js';
import type { CorpusManifest } from './platform/corpus-sdk.js';

export type SkillCorpusManifest = CorpusManifest & {
  by_claim_type: Record<string, number>;
  by_status: Record<string, number>;
};

function mapManifest(manifest: CorpusManifest): SkillCorpusManifest {
  const dimensions = (manifest.dimensions ?? {}) as {
    by_claim_type?: Record<string, number>;
    by_status?: Record<string, number>;
  };
  return {
    ...manifest,
    by_claim_type: dimensions.by_claim_type ?? {},
    by_status: dimensions.by_status ?? {},
  };
}

export function buildSkillCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): SkillCorpusManifest {
  const now = options?.now ?? new Date();
  const bundle = skillCorpusPlugin.load(options?.customRoot);
  return mapManifest(skillCorpusPlugin.buildManifest(bundle.entries, bundle.root, now));
}

export function writeSkillCorpusManifest(options?: {
  customRoot?: string;
  now?: Date;
}): SkillCorpusManifest {
  const manifest = writeCorpusManifest(skillCorpusPlugin, options);
  return mapManifest(manifest);
}
