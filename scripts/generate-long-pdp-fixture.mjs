import { createRequire } from 'node:module';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, '..');
const require = createRequire(join(root, 'packages/application/package.json'));
const sharp = require('sharp');

const outDir = join(root, 'benchmark', 'fixtures', 'image-compliance');
await mkdir(join(outDir, 'stubs'), { recursive: true });
await mkdir(join(outDir, 'raw'), { recursive: true });

const width = 750;
const height = 15000;
const sections = [
  { y: 0, h: 1200, color: 'rgb(30,30,40)' },
  { y: 1200, h: 1500, color: 'rgb(60,60,80)' },
  { y: 2700, h: 2200, color: 'rgb(40,70,90)' },
  { y: 4900, h: 2000, color: 'rgb(80,50,40)' },
  { y: 6900, h: 1800, color: 'rgb(50,80,50)' },
  { y: 8700, h: 2500, color: 'rgb(90,90,40)' },
  { y: 11200, h: 3800, color: 'rgb(40,40,60)' },
];

const rects = sections
  .map(
    (section) =>
      `<rect x="0" y="${section.y}" width="${width}" height="${section.h}" fill="${section.color}" />`,
  )
  .join('\n');

const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
${rects}
<text x="40" y="300" fill="white" font-size="48">Joyoung Pressure Cooker</text>
<text x="40" y="2900" fill="white" font-size="36">开始</text>
<text x="40" y="2950" fill="white" font-size="28">112kPa working pressure</text>
<text x="40" y="9100" fill="white" font-size="28">80kPa working pressure</text>
</svg>`;

const posPath = join(outDir, 'cn-pdp-pressure-cooker-pos.jpg');
const negPath = join(outDir, 'cn-pdp-pressure-cooker-neg.jpg');

await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(posPath);
await copyFile(posPath, negPath);

const emptySlice = {
  prompt_pack_version: 'demo-vision-1.0.0',
  extracted_text: [],
  findings: [],
};

await writeFile(
  join(outDir, 'stubs', 'cn-pdp-pressure-cooker-pos-slice0.json'),
  JSON.stringify(emptySlice, null, 2),
);
await writeFile(
  join(outDir, 'stubs', 'cn-pdp-pressure-cooker-pos-slice1.json'),
  JSON.stringify(emptySlice, null, 2),
);
await writeFile(
  join(outDir, 'stubs', 'cn-pdp-pressure-cooker-pos-slice3.json'),
  JSON.stringify(emptySlice, null, 2),
);
await writeFile(
  join(outDir, 'stubs', 'cn-pdp-pressure-cooker-pos-slice4.json'),
  JSON.stringify(emptySlice, null, 2),
);
await writeFile(
  join(outDir, 'stubs', 'cn-pdp-pressure-cooker-pos-slice6.json'),
  JSON.stringify(emptySlice, null, 2),
);

await writeFile(
  join(outDir, 'stubs', 'cn-pdp-pressure-cooker-pos-slice2.json'),
  JSON.stringify(
    {
      prompt_pack_version: 'demo-vision-1.0.0',
      extracted_text: ['开始', '112kPa'],
      findings: [
        {
          risk_type: 'localisation-error',
          description: 'Chinese-only control panel visible on SG listing image.',
          severity: 'MEDIUM',
          suggested_action: 'WARN',
          confidence: 0.91,
          scan_dimension: 'panel_language',
          evidence_spans: [
            {
              field: 'image',
              slice_index: 2,
              region_description: 'control panel',
              text: '开始',
            },
          ],
        },
      ],
    },
    null,
    2,
  ),
);

await writeFile(
  join(outDir, 'stubs', 'cn-pdp-pressure-cooker-pos-slice5.json'),
  JSON.stringify(
    {
      prompt_pack_version: 'demo-vision-1.0.0',
      extracted_text: ['80kPa'],
      findings: [],
    },
    null,
    2,
  ),
);

await writeFile(
  join(outDir, 'stubs', 'cn-pdp-pressure-cooker-pos.json'),
  JSON.stringify(emptySlice, null, 2),
);

await writeFile(
  join(outDir, 'stubs', 'cn-pdp-pressure-cooker-neg.json'),
  JSON.stringify(emptySlice, null, 2),
);

console.log(`Wrote ${posPath} (${width}x${height}) and pressure-cooker stubs`);
