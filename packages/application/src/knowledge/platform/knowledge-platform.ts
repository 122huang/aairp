import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CorpusType } from '../knowledge-corpus.js';
import type { KnowledgeCorpusPlugin } from './corpus-sdk.js';
import type { KnowledgeEntryBase } from './knowledge-entry.js';
import { regulationCorpusPlugin } from '../corpus/regulation-corpus.plugin.js';
import { skillCorpusPlugin } from '../corpus/skill-corpus.plugin.js';
import { rewriteCorpusPlugin } from '../corpus/rewrite-corpus.plugin.js';
import { evidenceCorpusPlugin } from '../corpus/evidence-corpus.plugin.js';
import { caseCorpusPlugin } from '../corpus/case-corpus.plugin.js';
import type { KnowledgePlatformSnapshot } from './corpus-sdk.js';

const plugins: Partial<Record<CorpusType, KnowledgeCorpusPlugin<KnowledgeEntryBase>>> = {
  regulation: regulationCorpusPlugin as unknown as KnowledgeCorpusPlugin<KnowledgeEntryBase>,
  skill: skillCorpusPlugin as unknown as KnowledgeCorpusPlugin<KnowledgeEntryBase>,
  rewrite: rewriteCorpusPlugin as unknown as KnowledgeCorpusPlugin<KnowledgeEntryBase>,
  evidence: evidenceCorpusPlugin as unknown as KnowledgeCorpusPlugin<KnowledgeEntryBase>,
  case: caseCorpusPlugin as unknown as KnowledgeCorpusPlugin<KnowledgeEntryBase>,
};

export function listRegisteredCorpusTypes(): CorpusType[] {
  return Object.keys(plugins) as CorpusType[];
}

export function getCorpusPlugin(corpusType: CorpusType): KnowledgeCorpusPlugin<KnowledgeEntryBase> | undefined {
  return plugins[corpusType];
}

export function requireCorpusPlugin(corpusType: CorpusType): KnowledgeCorpusPlugin<KnowledgeEntryBase> {
  const plugin = getCorpusPlugin(corpusType);
  if (!plugin) {
    throw new Error(`No Knowledge Platform plugin registered for corpus_type: ${corpusType}`);
  }
  return plugin;
}

export function registerCorpusPlugin<T extends KnowledgeEntryBase>(
  plugin: KnowledgeCorpusPlugin<T>,
): void {
  plugins[plugin.corpus_type] = plugin as unknown as KnowledgeCorpusPlugin<KnowledgeEntryBase>;
}

function defaultReportsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../reports');
}

export function buildKnowledgePlatformSnapshot(now: Date = new Date()): KnowledgePlatformSnapshot {
  const corpora = listRegisteredCorpusTypes().map((corpusType) => {
    const plugin = requireCorpusPlugin(corpusType);
    const bundle = plugin.load();
    const coverage = plugin.buildCoverage(bundle.entries, now);
    const validation = plugin.validate(bundle.entries, { now, knownRuleIds: plugin.knownRuleIds?.() });
    return {
      corpus_type: corpusType,
      entry_count: bundle.entries.length,
      knowledge_quality_score: coverage.knowledge_quality_score.overall,
      freshness: coverage.freshness,
      validation_errors: validation.error_count,
      governance_warnings: validation.warn_count,
    };
  });

  return {
    platform_version: '1.0.0',
    generated_at: now.toISOString(),
    corpora,
  };
}

export {
  buildCorpusDashboard,
  writeCorpusDashboard,
  writeCorpusCoverageReport,
  writeCorpusManifest,
} from './governance/dashboard.js';

export function platformReportsDir(): string {
  return defaultReportsDir();
}
