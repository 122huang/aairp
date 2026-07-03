import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildKnowledgePlatformSnapshot,
  writeCorpusDashboard,
  requireCorpusPlugin,
  listRegisteredCorpusTypes,
} from './platform/knowledge-platform.js';

async function main(): Promise<void> {
  const now = new Date();
  const snapshot = buildKnowledgePlatformSnapshot(now);
  const reportsDir = join(requireCorpusPlugin('regulation').defaultReportsDir());
  mkdirSync(reportsDir, { recursive: true });
  const timestamp = snapshot.generated_at.replace(/[:.]/g, '-');
  writeFileSync(
    join(reportsDir, `knowledge-platform-${timestamp}.json`),
    `${JSON.stringify(snapshot, null, 2)}\n`,
  );

  console.log('Knowledge Platform Core');
  console.log(`  platform version: ${snapshot.platform_version}`);
  for (const corpus of snapshot.corpora) {
    console.log(
      `  ${corpus.corpus_type}: ${corpus.entry_count} entries, KQS ${corpus.knowledge_quality_score}%, warnings ${corpus.governance_warnings}`,
    );
  }

  for (const corpusType of listRegisteredCorpusTypes()) {
    writeCorpusDashboard(requireCorpusPlugin(corpusType), { now });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
