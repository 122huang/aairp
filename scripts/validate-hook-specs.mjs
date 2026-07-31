/**
 * Validate docs/knowledge/compiler/hooks/*.hook.json against hook-spec.schema.json.
 * Usage: node scripts/validate-hook-specs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'docs/knowledge/compiler/hook-spec.schema.json');
const hooksDir = path.join(root, 'docs/knowledge/compiler/hooks');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const hookFiles = fs.readdirSync(hooksDir).filter((f) => f.endsWith('.hook.json'));

if (hookFiles.length === 0) {
  console.error('No hook specs found');
  process.exit(1);
}

/** Minimal required-field + enum validator (no ajv dependency). */
function validateHook(hook, file) {
  const errors = [];
  for (const key of schema.required) {
    if (hook[key] === undefined || hook[key] === null || hook[key] === '') {
      errors.push(`missing ${key}`);
    }
  }
  if (hook.hook_id && !/^hook-[a-z0-9-]+$/.test(hook.hook_id)) {
    errors.push(`invalid hook_id ${hook.hook_id}`);
  }
  if (hook.status && !['draft', 'accepted', 'deprecated'].includes(hook.status)) {
    errors.push(`invalid status ${hook.status}`);
  }
  const markets = schema.properties.markets.items.enum;
  if (Array.isArray(hook.markets)) {
    if (hook.markets.length === 0) errors.push('markets empty');
    for (const m of hook.markets) {
      if (!markets.includes(m)) errors.push(`invalid market ${m}`);
    }
  }
  const rb = hook.runtime_binding;
  if (!rb || !rb.kind) {
    errors.push('runtime_binding.kind required');
  } else if (!['rule', 'fusion_invariant', 'open_risk_guardrail'].includes(rb.kind)) {
    errors.push(`invalid runtime_binding.kind ${rb.kind}`);
  } else if (rb.kind === 'rule' && !rb.rule_id) {
    errors.push('runtime_binding.rule_id required when kind=rule');
  }
  if (!hook.handbook_ref) errors.push('handbook_ref required');
  if (errors.length) {
    throw new Error(`${file}: ${errors.join('; ')}`);
  }
}

let ok = 0;
for (const file of hookFiles) {
  const hook = JSON.parse(fs.readFileSync(path.join(hooksDir, file), 'utf8'));
  validateHook(hook, file);
  ok += 1;
  console.log('ok', file, hook.hook_id, hook.status);
}

console.log(`validated ${ok} hook specs`);
