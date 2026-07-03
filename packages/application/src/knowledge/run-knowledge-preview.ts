import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildKnowledgePreviewReport,
  formatKnowledgePreviewMarkdown,
} from './knowledge-preview.service.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const textIndex = args.indexOf('--text');
  const countryIndex = args.indexOf('--country');
  const categoryIndex = args.indexOf('--category');
  const claimText = textIndex >= 0 ? args[textIndex + 1] : 'removes 99.9999% bacteria';
  const country = countryIndex >= 0 ? args[countryIndex + 1] : 'SG';
  const category = categoryIndex >= 0 ? args[categoryIndex + 1] : undefined;

  if (!claimText) {
    throw new Error('Missing --text argument');
  }

  const report = buildKnowledgePreviewReport({
    claim_text: claimText,
    country,
    category,
  });

  const reportsDir = join(process.cwd(), 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  const mdPath = join(reportsDir, `knowledge-preview-${timestamp}.md`);
  writeFileSync(mdPath, `${formatKnowledgePreviewMarkdown(report)}\n`);

  console.log('Knowledge Preview Report');
  console.log(`  preview_id: ${report.preview_id}`);
  console.log(`  headline: ${report.headline}`);
  console.log(`  primary_skill: ${report.primary_skill_label ?? '(none)'}`);
  console.log(`  matched_skills: ${report.matched_skills.length}`);
  console.log(`  markdown: ${mdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
