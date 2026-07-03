import { writeRewriteCorpusManifest } from './rewrite-corpus-index.js';

async function main(): Promise<void> {
  const manifest = writeRewriteCorpusManifest();
  console.log('Rewrite Corpus Index');
  console.log(`  entries: ${manifest.entry_count}`);
  console.log(`  fingerprint: ${manifest.fingerprint}`);
  console.log(`  KQS: ${manifest.knowledge_quality_score}%`);
  console.log(`  manifest: docs/knowledge/rewrite-corpus/rewrite-corpus.manifest.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
