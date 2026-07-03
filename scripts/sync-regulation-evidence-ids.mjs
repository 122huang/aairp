import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = join(repoRoot, 'docs/knowledge/evidence-corpus/evidence');
const regulationsRoot = join(repoRoot, 'docs/knowledge/regulation-corpus/regulations');

const evidenceByRegulation = new Map();

for (const file of readdirSync(evidenceDir).filter((name) => name.endsWith('.json'))) {
  const entry = JSON.parse(readFileSync(join(evidenceDir, file), 'utf8'));
  for (const regulationId of entry.linkage?.regulations ?? []) {
    const bucket = evidenceByRegulation.get(regulationId) ?? new Set();
    bucket.add(entry.knowledge_id);
    evidenceByRegulation.set(regulationId, bucket);
  }
}

function walkRegulations(dir) {
  const files = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...walkRegulations(fullPath));
    } else if (item.isFile() && item.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

let updated = 0;
for (const filePath of walkRegulations(regulationsRoot)) {
  const regulation = JSON.parse(readFileSync(filePath, 'utf8'));
  const evidenceIds = [...(evidenceByRegulation.get(regulation.knowledge_id) ?? new Set())].sort();
  if (evidenceIds.length === 0) {
    continue;
  }
  const existing = [...(regulation.related_evidence_ids ?? [])].sort();
  if (JSON.stringify(existing) === JSON.stringify(evidenceIds)) {
    continue;
  }
  regulation.related_evidence_ids = evidenceIds;
  writeFileSync(filePath, `${JSON.stringify(regulation, null, 2)}\n`);
  updated += 1;
}

console.log(`Updated related_evidence_ids on ${updated} regulation entries`);
