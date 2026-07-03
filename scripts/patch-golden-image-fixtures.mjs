/**
 * One-shot: attach PR-C image/doc fixtures to golden-benchmark-v1-cases.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const casesPath = join(dirname(fileURLToPath(import.meta.url)), 'golden-benchmark-v1-cases.json');
const cases = JSON.parse(readFileSync(casesPath, 'utf8'));

const img = (id) => `https://demo/golden/${id}.png`;

const FIXTURES = {
  'AF-001': {
    content: {
      text: 'Air fryer hero banner',
      images: [img('AF-001')],
      ocr_text: '美的智能空气炸锅 额定电压220V 中国制造',
    },
  },
  'AF-005': {
    content: {
      text: 'Comparison banner',
      images: [img('AF-005')],
      ocr_text: 'Side by side with Midea air fryer model',
    },
  },
  'AF-008': {
    content: {
      text: 'Crispy chicken wings',
      images: [img('AF-008')],
      ocr_text: 'Golden crispy chicken wings',
    },
    context: { ai_image_quality_issue: true },
  },
  'AF-010': {
    content: {
      text: 'Certification badge inset',
      images: [img('AF-010')],
      ocr_text: 'ISO quality mark (blurred)',
    },
    context: { certification_image_unreadable: true },
  },
  'PC-001': {
    content: {
      text: 'Rice cooker product shot',
      images: [img('PC-001')],
      ocr_text: '九阳电饭煲 智能预约 中国制造',
    },
  },
  'PC-010': {
    content: {
      text: 'Layout draft banner',
      images: [img('PC-010')],
      ocr_text: 'DRAFT — internal design note visible on layer',
    },
  },
  'PC-013': {
    content: {
      text: 'Manual inset photo',
      images: [img('PC-013')],
      ocr_text: '产品使用说明书 安装步骤 注意事项 中文版',
    },
  },
  'BL-001': {
    content: {
      text: 'Blender packaging',
      images: [img('BL-001')],
      ocr_text: '苏泊尔破壁机 中文包装',
    },
  },
  'BL-010': {
    content: {
      text: 'Promo tile',
      images: [img('BL-010')],
      ocr_text: 'INTERNAL USE ONLY — not for publication',
    },
  },
  'BL-011': {
    content: {
      text: 'Certification panel',
      images: [img('BL-011')],
      ocr_text: 'ISO 9001 badge INTERNAL REVIEW COPY',
    },
  },
  'BL-012': {
    content: {
      text: 'Warranty card photo',
      images: [img('BL-012')],
      ocr_text: '保修卡 全国联保 中文填写',
    },
  },
  'BL-016': {
    content: {
      text: 'Family lifestyle scene',
      images: [img('BL-016')],
      ocr_text: 'Enjoy healthy smoothies together',
    },
    context: { ai_rendered_image: true, ai_image_quality_issue: true },
  },
  'RC18-002': {
    content: {
      text: 'Cooker packaging',
      images: [img('RC18-002')],
      ocr_text: '美的电压力锅 中文标签',
    },
  },
  'RC40-002': {
    content: {
      text: 'Patent diagram',
      images: [img('RC40-002')],
      ocr_text: 'Patent illustration INTERNAL NOTES watermark',
    },
  },
  'RC40-007': {
    content: {
      text: 'User manual excerpt',
      ocr_text: 'Safety instructions — INTERNAL design note for factory only',
    },
  },
  'LZ9-004': {
    content: {
      text: 'Juicer packaging',
      images: [img('LZ9-004')],
      ocr_text: '九阳榨汁机 中文说明',
    },
  },
  'P655-003': {
    content: {
      text: 'Lab report inset',
      images: [img('P655-003')],
      ocr_text: 'Third-party test report seal',
    },
    context: { certification_image_unreadable: true },
  },
  'P655-004': {
    content: {
      text: 'Manual page',
      images: [img('P655-004')],
      ocr_text: '产品使用说明 中文手册',
    },
  },
  'GEN-002': {
    content: {
      text: 'Certification report scan',
      images: [img('GEN-002')],
      ocr_text: 'Test laboratory certificate scan',
    },
    context: { certification_image_unreadable: true },
  },
};

let patched = 0;
for (const testCase of cases) {
  const fixture = FIXTURES[testCase.id];
  if (fixture) {
    testCase.fixture = fixture;
    patched++;
  }
}

writeFileSync(casesPath, JSON.stringify(cases, null, 2) + '\n', 'utf8');
console.log(`Patched ${patched} golden cases with fixtures.`);
