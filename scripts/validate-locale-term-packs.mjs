#!/usr/bin/env node
/**
 * Validates demo/locales/*.json term packs:
 * - country_id matches filename
 * - every source_regulation_id exists in regulation corpus
 * - corpus country matches pack country_id
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(repoRoot, 'demo/locales');
const corpusDir = join(repoRoot, 'docs/knowledge/regulation-corpus/regulations');

function loadRegulationIndex() {
  const byId = new Map();
  for (const countryCode of readdirSync(corpusDir, { withFileTypes: true })) {
    if (!countryCode.isDirectory()) continue;
    const country = countryCode.name;
    const countryPath = join(corpusDir, country);
    for (const file of readdirSync(countryPath)) {
      if (!file.endsWith('.json')) continue;
      const entry = JSON.parse(readFileSync(join(countryPath, file), 'utf8'));
      byId.set(entry.regulation_id, entry.country);
    }
  }
  return byId;
}

function validatePack(fileName, regulationIndex) {
  const countryFromFile = fileName.replace(/\.json$/, '').toUpperCase();
  const pack = JSON.parse(readFileSync(join(localesDir, fileName), 'utf8'));
  const issues = [];

  if (pack.country_id !== countryFromFile) {
    issues.push(`country_id ${pack.country_id} does not match file ${fileName}`);
  }

  for (const [index, row] of (pack.terms ?? []).entries()) {
    const label = `${fileName} terms[${index}] (${row.risk_type}/${row.lang})`;
    if (!row.source_regulation_id) {
      issues.push(`${label}: missing source_regulation_id`);
      continue;
    }
    const corpusCountry = regulationIndex.get(row.source_regulation_id);
    if (!corpusCountry) {
      issues.push(`${label}: unknown source_regulation_id ${row.source_regulation_id}`);
      continue;
    }
    if (corpusCountry !== pack.country_id) {
      issues.push(
        `${label}: source_regulation_id ${row.source_regulation_id} is ${corpusCountry}, expected ${pack.country_id}`,
      );
    }
  }

  return {
    fileName,
    country_id: pack.country_id,
    locale_pack_version: pack.locale_pack_version,
    term_rows: pack.terms?.length ?? 0,
    trigger_terms: (pack.terms ?? []).reduce((sum, row) => sum + (row.terms?.length ?? 0), 0),
    pending_rule_rows: (pack.terms ?? []).filter((row) => row.status === 'pending-rule').length,
    issues,
  };
}

const regulationIndex = loadRegulationIndex();
const packFiles = readdirSync(localesDir).filter((name) => name.endsWith('.json')).sort();
const results = packFiles.map((fileName) => validatePack(fileName, regulationIndex));
const issues = results.flatMap((result) => result.issues);

console.log('Locale term pack corpus linkage validation');
console.log(`  regulation corpus entries indexed: ${regulationIndex.size}`);
for (const result of results) {
  console.log(
    `  ${result.fileName}: ${result.term_rows} rows, ${result.trigger_terms} terms, ${result.pending_rule_rows} pending-rule`,
  );
}
console.log(`  result: ${issues.length === 0 ? 'PASSED' : 'FAILED'}`);
if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exitCode = 1;
}
