import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parsePlaybookMarkdown } from '../review/playbook-engine.service.js';
import { loadBenchmarkV3 } from '../evaluation/load-benchmark-v3.js';
import type { CorpusType } from './knowledge-corpus.js';
import {
  buildKnowledgePlatformSnapshot,
  listRegisteredCorpusTypes,
  requireCorpusPlugin,
} from './platform/knowledge-platform.js';
import { KNOWLEDGE_PLATFORM_VERSION } from './platform/corpus-sdk.js';
import type { KnowledgeEntryBase } from './platform/knowledge-entry.js';
import type { KnowledgeLinkage } from './platform/knowledge-linkage.js';
import { loadCaseCorpusEntries } from './case-corpus.js';
import { attachFingerprint } from './knowledge-pack-fingerprint.js';
import {
  KNOWLEDGE_PACK_SCHEMA_V2,
  knowledgePackReleasesDir,
  repoRoot,
  type CorpusSnapshot,
  type DependencyGraphSnapshot,
  type KnowledgePackV2,
  type KnowledgePackV2Body,
  type PackReleaseStatus,
} from './knowledge-pack.js';

const REQUIRED_CORPORA = listRegisteredCorpusTypes();

function relativeManifestPath(corpusRoot: string, filename: string): string {
  const root = repoRoot().replace(/\\/g, '/');
  const corpus = corpusRoot.replace(/\\/g, '/');
  if (corpus.startsWith(root)) {
    return corpus.slice(root.length + 1) + '/' + filename;
  }
  return join(corpusRoot, filename).replace(/\\/g, '/');
}

function loadRegressionBaselineRef(): string {
  const baselinePath = join(repoRoot(), 'benchmark/benchmark-v3-baseline.json');
  if (!existsSync(baselinePath)) {
    return 'benchmark/benchmark-v3-baseline.json';
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { baseline_id?: string };
  return baseline.baseline_id ?? 'benchmark/benchmark-v3-baseline.json';
}

function nextKnowledgePackId(now: Date): string {
  const stamp = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const prefix = `kp-${stamp}.`;
  const releasesDir = knowledgePackReleasesDir();
  let existing: string[] = [];
  if (existsSync(releasesDir)) {
    existing = readdirSync(releasesDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''));
  }
  const patches = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number.parseInt(id.slice(prefix.length), 10))
    .filter((value) => !Number.isNaN(value));
  const next = patches.length === 0 ? 1 : Math.max(...patches) + 1;
  return `${prefix}${next}`;
}

function buildCorpusSnapshots(now: Date): Record<string, CorpusSnapshot> {
  const snapshots: Record<string, CorpusSnapshot> = {};
  for (const corpusType of REQUIRED_CORPORA) {
    const plugin = requireCorpusPlugin(corpusType);
    const bundle = plugin.load();
    const validation = plugin.validate(bundle.entries, {
      now,
      knownRuleIds: plugin.knownRuleIds?.(),
    });
    const manifest = plugin.buildManifest(bundle.entries, bundle.root, now);
    snapshots[corpusType] = {
      corpus_type: corpusType,
      manifest_path: relativeManifestPath(bundle.root, manifest.manifest_filename),
      schema_version: manifest.schema_version,
      fingerprint: manifest.fingerprint,
      entry_count: manifest.entry_count,
      knowledge_quality_score: manifest.knowledge_quality_score,
      manifest_generated_at: manifest.generated_at,
      validation: {
        errors: validation.error_count,
        warnings: validation.warn_count,
      },
    };
  }
  return snapshots as Record<CorpusType, CorpusSnapshot>;
}

function countLinkage<T extends KnowledgeEntryBase>(
  entries: T[],
  getLinkage: (entry: T) => KnowledgeLinkage,
  from: keyof KnowledgeLinkage,
): number {
  let count = 0;
  for (const entry of entries) {
    const linkage = getLinkage(entry);
    count += linkage[from]?.length ?? 0;
  }
  return count;
}

function buildDependencyGraph(now: Date): DependencyGraphSnapshot {
  const nodes: Record<string, number> = {};
  const edges: Record<string, number> = {
    regulation_to_skill: 0,
    skill_to_rewrite: 0,
    skill_to_evidence: 0,
    rewrite_to_case: 0,
    evidence_to_case: 0,
    case_to_benchmark: 0,
  };

  const rulesPack = JSON.parse(
    readFileSync(join(repoRoot(), 'demo/rules.demo.json'), 'utf8'),
  ) as { rules: unknown[] };
  nodes.rule = rulesPack.rules.length;

  for (const corpusType of REQUIRED_CORPORA) {
    const plugin = requireCorpusPlugin(corpusType);
    const bundle = plugin.load();
    nodes[corpusType] = bundle.entries.length;
  }

  const skillPlugin = requireCorpusPlugin('skill');
  const rewritePlugin = requireCorpusPlugin('rewrite');
  const evidencePlugin = requireCorpusPlugin('evidence');

  edges.regulation_to_skill = countLinkage(
    skillPlugin.load().entries,
    skillPlugin.getLinkage,
    'regulations',
  );
  edges.skill_to_rewrite = countLinkage(
    rewritePlugin.load().entries,
    rewritePlugin.getLinkage,
    'skills',
  );
  edges.skill_to_evidence = countLinkage(
    evidencePlugin.load().entries,
    evidencePlugin.getLinkage,
    'skills',
  );

  const caseEntries = loadCaseCorpusEntries();
  edges.case_to_benchmark = caseEntries.filter((entry) => entry.benchmark_ref).length;
  for (const entry of caseEntries) {
    edges.rewrite_to_case += entry.linkage.rewrites?.length ?? 0;
    edges.evidence_to_case += entry.linkage.evidence?.length ?? 0;
  }

  const regulationEntries = requireCorpusPlugin('regulation').load().entries;
  const skillEntries = skillPlugin.load().entries;
  const rewriteEntries = rewritePlugin.load().entries;

  let regulationWithoutRule = 0;
  for (const entry of regulationEntries) {
    if ((entry.linkage?.rules?.length ?? 0) === 0) {
      regulationWithoutRule += 1;
    }
  }

  let skillWithoutRegulation = 0;
  for (const entry of skillEntries) {
    if ((entry.linkage?.regulations?.length ?? 0) === 0) {
      skillWithoutRegulation += 1;
    }
  }

  let rewriteWithoutSkill = 0;
  for (const entry of rewriteEntries) {
    if ((entry.linkage?.skills?.length ?? 0) === 0) {
      rewriteWithoutSkill += 1;
    }
  }

  const caseWithoutBenchmark = caseEntries.filter((entry) => !entry.benchmark_ref).length;

  return {
    frozen_at: now.toISOString(),
    nodes,
    edges,
    orphan_counts: {
      regulation_without_rule: regulationWithoutRule,
      skill_without_regulation: skillWithoutRegulation,
      rewrite_without_skill: rewriteWithoutSkill,
      case_without_benchmark_ref: caseWithoutBenchmark,
    },
  };
}

function buildCaseCorpusLinkage(caseSnapshot: CorpusSnapshot): KnowledgePackV2Body['evaluation_linkage']['case_corpus'] {
  const entries = loadCaseCorpusEntries();
  const benchmarkPath = join(repoRoot(), 'benchmark/benchmark-v3.json');
  const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as { cases: Array<{ case_id: string }> };
  const benchmarkTotal = benchmark.cases.length;
  const benchmarkCovered = new Set(entries.map((entry) => entry.benchmark_ref)).size;

  return {
    fingerprint: caseSnapshot.fingerprint,
    entry_count: caseSnapshot.entry_count,
    benchmark_coverage: {
      covered: benchmarkCovered,
      total: benchmarkTotal,
      pct: benchmarkTotal > 0 ? Math.round((benchmarkCovered / benchmarkTotal) * 1000) / 10 : 0,
    },
    verified_count: entries.filter((entry) => entry.case_status === 'verified').length,
    regression_count: entries.filter((entry) => entry.case_status === 'regression').length,
  };
}

function buildOwnershipSummary(): KnowledgePackV2Body['ownership_summary'] {
  let corporaTotal = 0;
  let green = 0;
  let yellow = 0;
  let red = 0;

  for (const corpusType of REQUIRED_CORPORA) {
    const plugin = requireCorpusPlugin(corpusType);
    const bundle = plugin.load();
    const coverage = plugin.buildCoverage(bundle.entries, new Date());
    corporaTotal += bundle.entries.length;
    green += coverage.freshness.green;
    yellow += coverage.freshness.yellow;
    red += coverage.freshness.red;
  }

  return {
    corpora_total_entries: corporaTotal,
    freshness_green: green,
    freshness_yellow: yellow,
    freshness_red: red,
  };
}

export type AssembleKnowledgePackOptions = {
  now?: Date;
  release_status?: PackReleaseStatus;
  knowledge_pack_id?: string;
  supersedes?: string;
};

export function assembleKnowledgePackDraft(options?: AssembleKnowledgePackOptions): KnowledgePackV2 {
  const now = options?.now ?? new Date();
  const corpora = buildCorpusSnapshots(now) as KnowledgePackV2Body['corpora'];
  const caseManifest = corpora.case;

  const benchmarkV3Path = join(repoRoot(), 'benchmark/benchmark-v3.json');
  const benchmarkV3 = existsSync(benchmarkV3Path) ? loadBenchmarkV3(benchmarkV3Path) : null;
  if (!benchmarkV3) {
    throw new Error('benchmark-v3.json is required for Knowledge Pack assembly');
  }

  const playbook = parsePlaybookMarkdown(
    readFileSync(join(repoRoot(), 'demo/playbook.demo.md'), 'utf8'),
  );
  const rulesPack = JSON.parse(
    readFileSync(join(repoRoot(), 'demo/rules.demo.json'), 'utf8'),
  ) as { pack_version: string; rules: unknown[] };

  const knowledge_pack_id = options?.knowledge_pack_id ?? nextKnowledgePackId(now);

  const body: KnowledgePackV2Body = {
    schema_version: KNOWLEDGE_PACK_SCHEMA_V2,
    knowledge_pack_id,
    knowledge_pack_version: knowledge_pack_id,
    platform_version: KNOWLEDGE_PLATFORM_VERSION,
    generated_at: now.toISOString(),
    release_status: options?.release_status ?? 'draft',
    supersedes: options?.supersedes,
    corpora,
    dependency_graph: buildDependencyGraph(now),
    runtime_components: {
      rules: {
        version: rulesPack.pack_version,
        count: rulesPack.rules.length,
        source: 'demo/rules.demo.json',
      },
      playbooks: {
        version: playbook.packVersion,
        playbook_id: playbook.playbookId,
        pattern_count: playbook.items.length,
        source: 'demo/playbook.demo.md',
      },
      legacy_references: {
        skill_modules: 'docs/knowledge/skill-modules.json',
      },
    },
    evaluation_linkage: {
      benchmark: {
        benchmark_id: benchmarkV3.benchmark_id,
        schema_version: benchmarkV3.schema_version,
        content_fingerprint: benchmarkV3.content_fingerprint,
        case_count: benchmarkV3.case_count,
        source: 'benchmark/benchmark-v3.json',
      },
      case_corpus: buildCaseCorpusLinkage(caseManifest),
      evaluation_profile: benchmarkV3.evaluation_profile,
      regression_baseline_ref: loadRegressionBaselineRef(),
    },
    compatibility: {
      min_platform_version: '1.0.0',
      max_platform_version: '1.x',
      required_corpora: REQUIRED_CORPORA.map((corpusType) => ({
        corpus_type: corpusType,
        min_schema_version: corpora[corpusType].schema_version,
      })),
      benchmark_min_schema: '3.0.0',
      linkage_validator_version: '2.0.0',
    },
    ownership_summary: buildOwnershipSummary(),
  };

  // Ensure platform snapshot can be built (all corpora registered).
  buildKnowledgePlatformSnapshot(now);

  return attachFingerprint(body);
}
