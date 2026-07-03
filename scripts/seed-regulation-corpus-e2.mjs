#!/usr/bin/env node
/**
 * Sprint 5A E2 — materialize regulation corpus entries from authoring batch.
 * Frequency-prioritized: Medical/Health/Comparative/Disclosure/Performance first.
 * Run: node scripts/seed-regulation-corpus-e2.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const corpusRoot = join(repoRoot, 'docs/knowledge/regulation-corpus');
const batchPath = join(corpusRoot, 'e2-authoring-batch.json');

const ENVELOPE = {
  owner: 'legal-apac@aairp',
  owner_type: 'legal',
  last_reviewed: '2026-06-29T00:00:00.000Z',
  review_status: 'legal_reviewed',
};

function materialize(entry) {
  const regulation_id = entry.regulation_id;
  return {
    knowledge_id: `regulation:${regulation_id}`,
    corpus_type: 'regulation',
    regulation_id,
    ...entry,
    related_evidence_ids: entry.related_evidence_ids ?? [],
    related_rule_ids: entry.related_rule_ids ?? [],
    ...ENVELOPE,
  };
}

function writeEntry(entry) {
  const full = materialize(entry);
  const countryDir = join(corpusRoot, 'regulations', full.country);
  mkdirSync(countryDir, { recursive: true });
  const filePath = join(countryDir, `${full.regulation_id}.json`);
  if (existsSync(filePath)) {
    const existing = JSON.parse(readFileSync(filePath, 'utf8'));
    if (existing.tags?.includes('demo-seed')) {
      return { skipped: full.regulation_id };
    }
  }
  writeFileSync(filePath, `${JSON.stringify(full, null, 2)}\n`, 'utf8');
  return { written: full.regulation_id };
}

const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
const results = batch.entries.map(writeEntry);
const written = results.filter((r) => r.written).length;
const skipped = results.filter((r) => r.skipped).length;
console.log(`E2 seed complete: ${written} written, ${skipped} skipped (demo seeds preserved)`);
