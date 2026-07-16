import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = 'C:/Users/ShujieHuang/aairp/assets/ach-review-result.png';
const URL = 'http://localhost:5173/review/';
const TEST_COPY = '少油烹饪，让您吃得更轻盈无负担。';

mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });

try {
  await page.goto(URL, { waitUntil: 'networkidle' });

  await page.locator('#ad-text').fill(TEST_COPY);

  const countryTrigger = page.locator('button[role="combobox"]').first();
  await countryTrigger.click();
  await page.getByRole('option', { name: /SG ·/ }).click();

  const categoryTrigger = page.locator('button[role="combobox"]').nth(1);
  await categoryTrigger.click();
  await page.getByRole('option', { name: '空气炸锅' }).click();

  await page.getByRole('button', { name: '提交审查' }).click();
  await page.waitForSelector('text=审查发现', { timeout: 45000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT, fullPage: true });
  console.log(`Saved ${OUT}`);
} finally {
  await browser.close();
}
