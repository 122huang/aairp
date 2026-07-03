import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CorpusType } from './knowledge-corpus.js';
import type { EvaluationProfile } from '../evaluation/load-benchmark-v3.js';

export const KNOWLEDGE_PACK_SCHEMA_V2 = '2.0.0';

export type PackReleaseStatus = 'draft' | 'validated' | 'released' | 'deprecated';

export type CorpusSnapshot = {
  corpus_type: CorpusType;
  manifest_path: string;
  schema_version: string;
  fingerprint: string;
  entry_count: number;
  knowledge_quality_score: number;
  manifest_generated_at: string;
  validation: { errors: number; warnings: number };
};

export type DependencyGraphSnapshot = {
  frozen_at: string;
  nodes: Record<string, number>;
  edges: Record<string, number>;
  orphan_counts: Record<string, number>;
};

export type CorpusCompatibilityRequirement = {
  corpus_type: CorpusType;
  min_schema_version: string;
};

export type KnowledgePackCompatibility = {
  min_platform_version: string;
  max_platform_version: string;
  required_corpora: CorpusCompatibilityRequirement[];
  benchmark_min_schema: string;
  linkage_validator_version: string;
};

export type KnowledgePackEvaluationLinkage = {
  benchmark: {
    benchmark_id: string;
    schema_version: string;
    content_fingerprint: string;
    case_count: number;
    source: string;
  };
  case_corpus: {
    fingerprint: string;
    entry_count: number;
    benchmark_coverage: { covered: number; total: number; pct: number };
    verified_count: number;
    regression_count: number;
  };
  evaluation_profile: EvaluationProfile;
  regression_baseline_ref: string;
};

export type KnowledgePackOwnershipSummary = {
  corpora_total_entries: number;
  freshness_green: number;
  freshness_yellow: number;
  freshness_red: number;
};

export type KnowledgePackV2Body = {
  schema_version: typeof KNOWLEDGE_PACK_SCHEMA_V2;
  knowledge_pack_id: string;
  knowledge_pack_version: string;
  platform_version: string;
  generated_at: string;
  release_status: PackReleaseStatus;
  released_at?: string;
  released_by?: string;
  supersedes?: string;
  deprecated_reason?: string;
  corpora: Record<CorpusType, CorpusSnapshot>;
  dependency_graph: DependencyGraphSnapshot;
  runtime_components: {
    rules: { version: string; count: number; source: string };
    playbooks: {
      version: string;
      playbook_id: string;
      pattern_count: number;
      source: string;
    };
    legacy_references?: {
      skill_modules: string;
    };
  };
  evaluation_linkage: KnowledgePackEvaluationLinkage;
  compatibility: KnowledgePackCompatibility;
  ownership_summary: KnowledgePackOwnershipSummary;
};

export type KnowledgePackV2 = KnowledgePackV2Body & {
  knowledge_pack_fingerprint: string;
};

/** Sprint 3–4 legacy shape — retained for backward compatibility reads. */
export type KnowledgePackLegacy = {
  knowledge_pack_version: string;
  knowledge_pack_fingerprint: string;
  generated_at: string;
  modules_version: string;
  taxonomy_version: string;
  linkage_validator_version: string;
  evaluation_profile: EvaluationProfile;
  ownership_summary: {
    skill_modules_with_owner: number;
    skill_modules_total: number;
    freshness_current: number;
    freshness_review_due: number;
    freshness_stale: number;
  };
  components: {
    regulations: { version: string; count: number; source: string };
    rules: { version: string; count: number; source: string };
    playbooks: {
      version: string;
      playbook_id: string;
      pattern_count: number;
      source: string;
    };
    benchmark_v2: {
      schema_version: string;
      benchmark_id: string;
      case_count: number;
      content_fingerprint: string;
      source: string;
    };
    benchmark_v3: {
      schema_version: string;
      benchmark_id: string;
      case_count: number;
      content_fingerprint: string;
      source: string;
    } | null;
    case_library?: { record_count: number; manifest_path: string };
  };
};

export type KnowledgePackManifest = KnowledgePackV2 | KnowledgePackLegacy;

export function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

export function knowledgePackDir(): string {
  return join(repoRoot(), 'benchmark/knowledge-pack');
}

export function knowledgePackDraftPath(): string {
  return join(knowledgePackDir(), 'drafts/knowledge-pack.draft.json');
}

export function knowledgePackReleasesDir(): string {
  return join(knowledgePackDir(), 'releases');
}

export function knowledgePackReleasePath(packId: string): string {
  return join(knowledgePackReleasesDir(), `${packId}.json`);
}

export function resolveKnowledgePackManifestPath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.AAIRP_KNOWLEDGE_PACK_MANIFEST_PATH) {
    return process.env.AAIRP_KNOWLEDGE_PACK_MANIFEST_PATH;
  }
  return join(repoRoot(), 'benchmark/knowledge-pack.manifest.json');
}

export function isKnowledgePackV2(pack: KnowledgePackManifest): pack is KnowledgePackV2 {
  return 'schema_version' in pack && pack.schema_version === KNOWLEDGE_PACK_SCHEMA_V2;
}

export function packVersion(pack: KnowledgePackManifest): string {
  return pack.knowledge_pack_version;
}

export function packFingerprint(pack: KnowledgePackManifest): string {
  return pack.knowledge_pack_fingerprint;
}

export function corpusFingerprints(pack: KnowledgePackManifest): Record<string, string> | null {
  if (!isKnowledgePackV2(pack)) {
    return null;
  }
  const result: Record<string, string> = {};
  for (const [corpusType, snapshot] of Object.entries(pack.corpora)) {
    result[corpusType] = snapshot.fingerprint;
  }
  return result;
}

export function loadKnowledgePackManifest(customPath?: string): KnowledgePackManifest | null {
  const path = resolveKnowledgePackManifestPath(customPath);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as KnowledgePackManifest;
}

export function loadKnowledgePackDraft(): KnowledgePackV2 | null {
  const path = knowledgePackDraftPath();
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as KnowledgePackV2;
}

export function loadReleasedKnowledgePack(packId: string): KnowledgePackV2 | null {
  const path = knowledgePackReleasePath(packId);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as KnowledgePackV2;
}
