#!/usr/bin/env node
/**
 * Backfill demo/playbook.demo.md with Skill metadata from skill-taxonomy.json.
 * Metadata-only; does not change trigger keywords or matching behavior.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const playbookPath = join(root, 'demo/playbook.demo.md');
const taxonomyPath = join(root, 'docs/knowledge/skill-taxonomy.json');

function parseFieldMap(sectionBody) {
  const fields = {};
  for (const line of sectionBody.split('\n')) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key && value) fields[key] = value;
  }
  return fields;
}

const taxonomy = JSON.parse(readFileSync(taxonomyPath, 'utf8'));
const metaByPattern = new Map();
for (const mod of taxonomy.modules) {
  for (const p of mod.patterns) {
    metaByPattern.set(p.pattern_id, {
      skill_module: mod.skill_module,
      purpose: p.purpose,
      suggested_rewrite: p.suggested_rewrite,
      expected_severity: p.default_expected_severity,
    });
  }
}

let content = readFileSync(playbookPath, 'utf8');
content = content.replace(/pack_version: demo-playbook-1\.3\.0/, 'pack_version: demo-playbook-1.4.0');

const sections = content.split(/^## /m);
const header = sections[0];
const updatedSections = sections.slice(1).map((section) => {
  const lines = section.trimEnd().split('\n');
  const patternId = lines[0]?.trim() ?? '';
  const meta = metaByPattern.get(patternId);
  if (!meta) {
    return section;
  }
  const body = lines.slice(1).join('\n');
  const fields = parseFieldMap(body);
  const kept = lines.slice(1).filter((line) => {
    const key = line.split(':')[0]?.trim();
    return !['skill_module', 'purpose', 'suggested_rewrite', 'expected_severity'].includes(key);
  });
  kept.push(
    `skill_module: ${meta.skill_module}`,
    `purpose: ${meta.purpose}`,
    `suggested_rewrite: ${meta.suggested_rewrite}`,
    `expected_severity: ${meta.expected_severity}`,
  );
  return `${patternId}\n${kept.join('\n')}\n`;
});

writeFileSync(playbookPath, `${header}${updatedSections.map((s) => `## ${s}`).join('')}`);
console.log(`Updated ${playbookPath} with Skill metadata (demo-playbook-1.4.0)`);
