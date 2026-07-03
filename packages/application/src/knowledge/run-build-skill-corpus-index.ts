import { writeSkillCorpusManifest } from './skill-corpus-index.js';

async function main(): Promise<void> {
  const manifest = writeSkillCorpusManifest();
  console.log('Skill Corpus Index');
  console.log(`  entries: ${manifest.entry_count}`);
  console.log(`  fingerprint: ${manifest.fingerprint}`);
  console.log(`  KQS: ${manifest.knowledge_quality_score}%`);
  console.log(`  manifest: docs/knowledge/skill-corpus/skill-corpus.manifest.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
