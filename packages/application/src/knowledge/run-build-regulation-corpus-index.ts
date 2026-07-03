import { writeRegulationCorpusManifest } from './regulation-corpus-index.js';

async function main(): Promise<void> {
  const manifest = writeRegulationCorpusManifest();
  console.log('Regulation Corpus Index');
  console.log(`  entries: ${manifest.entry_count}`);
  console.log(`  fingerprint: ${manifest.fingerprint}`);
  console.log(`  KQS: ${manifest.knowledge_quality_score}%`);
  console.log(`  manifest: ${manifest.corpus_root}/regulation-corpus.manifest.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
