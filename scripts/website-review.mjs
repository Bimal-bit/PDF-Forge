/* global console, document, innerWidth, process, requestAnimationFrame */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'docs/images/website';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [], external = [], layouts = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5173/')) external.push(request.url());
});
const capture = async (name, fullPage = false) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${output}/${name}.png`, fullPage });
  layouts.push({ name, viewport: page.viewportSize(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
};
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(() => document.fonts.ready);
  await capture('landing-desktop', true);
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('landing-phone', true);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await capture('landing-menu');
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles('fixtures/text.pdf');
  await page.locator('.text-layer').first().waitFor();
  for (const name of ['Home', 'Insert', 'Layout', 'Review', 'View', 'Tools']) {
    await page.getByRole('navigation', { name: 'Ribbon tabs' }).getByRole('button', { name, exact: true }).click();
    await capture(`editor-${name.toLowerCase()}`);
  }
  await page.getByRole('button', { name: 'Search actions', exact: true }).click();
  await page.getByLabel('Search commands').fill('');
  await capture('actions-desktop');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await page.getByRole('button', { name: 'Search actions', exact: true }).click();
  await capture('actions-dark');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 900, height: 720 });
  await capture('editor-tablet-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Search actions', exact: true }).click();
  await page.getByLabel('Search commands').fill('unavailable');
  await capture('actions-phone-empty');
  await page.keyboard.press('Escape');
  await capture('editor-phone-dark');
  await page.setViewportSize({ width: 844, height: 390 });
  await capture('editor-landscape-dark');
  await writeFile('docs/website-visual-results.json', JSON.stringify({ errors, external, layouts }, null, 2));
  console.log(JSON.stringify({ errors, external, layouts }, null, 2));
  if (errors.length || external.length || layouts.some((layout) => layout.overflow)) process.exitCode = 1;
} finally {
  await browser.close();
}
