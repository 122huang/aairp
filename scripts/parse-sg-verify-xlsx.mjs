import { readFileSync } from 'node:fs';

const sst = readFileSync('scripts/_xlsx_tmp/xl/sharedStrings.xml', 'utf8');
const strings = [...sst.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
  m[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#10;/g, '\n'),
);

const sheet = readFileSync('scripts/_xlsx_tmp/xl/worksheets/sheet1.xml', 'utf8');
const rows = [...sheet.matchAll(/<row r="(\d+)"[\s\S]*?<\/row>/g)];

const out = [];
for (const row of rows) {
  const r = row[1];
  if (r === '2') continue;
  const cells = [...row[0].matchAll(/<c r="([A-Z]+)\d+"[^>]*t="s"[^>]*><v>(\d+)<\/v>/g)];
  if (!cells.length) continue;
  const vals = {};
  for (const c of cells) vals[c[1]] = strings[Number(c[2])];
  if (vals.B) {
    out.push({
      row: Number(r),
      product: vals.B,
      text: vals.C ?? '',
      result: vals.D ?? '',
      note: vals.E ?? '',
    });
  }
}
console.log(JSON.stringify(out, null, 2));
