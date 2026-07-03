#!/usr/bin/env node
/**
 * Merge RC1 demo cases + pilot L2 cases into apps/demo-ui/public/demo-cases.json
 * Run: node scripts/build-legal-demo-cases.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const RC1 = [
  {
    id: 'demo-01-reject-cure',
    group: 'demo',
    title: '禁止「治愈」表述 → REJECT',
    subtitle: '规则 BLOCKER + 法规引用',
    expected_decision: 'REJECT',
    highlight: '法规→规则硬拦截；LLM 步骤跳过',
    upload: {
      external_ref: 'rc1-demo-001',
      tenant_id: 'demo',
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: {
        text: 'Clinically proven to cure diabetes in 7 days. Buy now!',
        images: ['https://cdn.example.com/ad-banner.png'],
        landing_url: 'https://example.com/promo',
      },
      context: { campaign_type: 'conversion', ad_format: 'image', target_audience: '25-45' },
      tags: ['rc1:reject', 'demo:blocker'],
    },
  },
  {
    id: 'demo-02-pass-food',
    group: 'demo',
    title: '合规食品广告 + #ad → PASS',
    subtitle: '全链路无命中',
    expected_decision: 'PASS',
    highlight: '确定性 PASS，对比纯 LLM 臆测风险',
    upload: {
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'food',
      content: { text: 'Organic snacks for everyday enjoyment. No artificial colours. #ad' },
      tags: ['rc1:pass', 'demo:food'],
    },
  },
  {
    id: 'demo-03-warn-disclosure',
    group: 'demo',
    title: '缺少 #ad 披露 → WARN',
    subtitle: '规则 — 低严重度',
    expected_decision: 'WARN',
    highlight: '法规驱动的披露规则，非 LLM 猜测',
    upload: {
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: { text: 'Daily vitamins for general wellness. Supports your active lifestyle.' },
      tags: ['rc1:warn', 'demo:disclosure'],
    },
  },
  {
    id: 'demo-04-warn-superlative',
    group: 'demo',
    title: '最高级/绝对化表述 → WARN',
    subtitle: '规则 + Playbook 双层命中',
    expected_decision: 'WARN',
    highlight: '法规层 vs 操作指引层同时可见',
    upload: {
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: {
        text: 'Clinically proven daily vitamins. Guaranteed results. Shop now. #ad',
      },
      tags: ['rc1:warn', 'demo:superlative'],
    },
  },
  {
    id: 'demo-05-pass-wellness',
    group: 'demo',
    title: '合规保健品文案 → PASS',
    subtitle: '含 #ad，无禁止用语',
    expected_decision: 'PASS',
    highlight: '完整链路；案例自动入库',
    upload: {
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: {
        text: 'Daily vitamins for general wellness. Not intended to diagnose or treat disease. #ad',
      },
      tags: ['rc1:pass', 'demo:wellness'],
    },
  },
];

const PILOT_TITLES = {
  'P-001': '绝对化 / perfect 表述',
  'P-002': '健康宣称 Lower Sugar / Healthier',
  'P-003': '比较宣称无基准',
};

function pilotToDemoCase(raw) {
  const human =
    raw.ground_truth?.human_decision ?? raw.intent ?? raw.ground_truth?.expected_decision ?? 'PASS';
  const engine = raw.ground_truth?.expected_decision;
  const pilotId = raw.pilot_id ?? raw.case_id;
  const issue = PILOT_TITLES[pilotId] ?? raw.issue_tags?.[0] ?? 'Pilot 案例';

  return {
    id: raw.case_id,
    group: 'pilot',
    title: `${pilotId} · ${raw.country_id} · ${issue}`,
    subtitle: `${raw.category_id} · 人工预期 ${human}`,
    expected_decision: human,
    human_intent: human,
    engine_may_differ: Boolean(engine && engine !== human),
    highlight: raw.notes ?? raw.human_rationale ?? 'Internal Pilot L2 真实文案',
    upload: raw.upload,
  };
}

const pilotIndex = JSON.parse(fs.readFileSync(path.join(root, 'pilot/index.json'), 'utf8'));
const pilotCases = pilotIndex.cases.map((entry) => {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'pilot', entry.path), 'utf8'));
  return pilotToDemoCase(raw);
});

const out = {
  schema_version: '1.1.0-legal-pilot-zh',
  description: '法务内测版 — SG 演示 5 条 + Pilot L2 真实案例 9 条；支持 UI 自定义粘贴',
  case_groups: {
    demo: { label: 'SG 演示', count: RC1.length },
    pilot: { label: 'Pilot 真实案例', count: pilotCases.length },
    custom: { label: '自定义', count: 0 },
  },
  cases: [...RC1, ...pilotCases],
};

const outPath = path.join(root, 'apps/demo-ui/public/demo-cases.json');
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`Wrote ${out.cases.length} cases → ${outPath}`);
console.log(`  demo: ${RC1.length} · pilot: ${pilotCases.length}`);
