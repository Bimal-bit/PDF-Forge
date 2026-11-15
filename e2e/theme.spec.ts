import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

test('Design7 welcome opens a local PDF and provides action search', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5173') && !/^(blob:|data:)/.test(request.url())) external.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('.brand-intro')).toBeHidden();
  await expect(page.locator('.paper-stage')).toBeVisible();
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  await page.getByLabel('Choose a PDF', { exact: true }).setInputFiles({ name: 'design.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByLabel('Rendered PDF pages')).toBeVisible();
  await expect(page.locator('.welcome')).toHaveCount(0);
  await page.getByRole('button', { name: /Search actions/ }).click();
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('.app')).toHaveClass(/theme-dark/);
  expect(external).toEqual([]);
});

test('reduced motion skips intro and floating effects while preserving keyboard access', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.brand-intro')).toBeHidden();
  const paper = page.locator('.paper-scene');
  await expect(paper).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('heading', { name: 'Open a PDF to begin' })).toBeVisible();
  await page.getByLabel('Choose a PDF', { exact: true }).focus();
  await expect(page.getByLabel('Choose a PDF', { exact: true })).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
});

test('short tablet welcome keeps the paper artwork above its heading', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const paper = await page.locator('.paper-front').boundingBox();
  const heading = await page.getByRole('heading', { name: 'Open a PDF to begin' }).boundingBox();
  expect(paper).not.toBeNull();
  expect(heading).not.toBeNull();
  expect(paper!.y + paper!.height).toBeLessThan(heading!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(900);
});
