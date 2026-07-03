import { writeEvidenceCorpusManifest } from './evidence-corpus-index.js';

async function main(): Promise<void> {
  const manifest = writeEvidenceCorpusManifest();
  console.log('Evidence Corpus Index');
  console.log(`  entries: ${manifest.entry_count}`);
  console.log(`  fingerprint: ${manifest.fingerprint}`);
  console.log(`  KQS: ${manifest.knowledge_quality_score}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
