import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

test('reference landing opens a local PDF and provides editor action search', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5173') && !/^(blob:|data:)/.test(request.url())) external.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('.brand-intro')).toBeHidden();
  await expect(page.locator('.landing-stage')).toBeVisible();
  await expect(page.locator('.ribbon')).toHaveCount(0);
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open a PDF', exact: true }).first().click();
  await (await chooser).setFiles({ name: 'design.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByLabel('Rendered PDF pages')).toBeVisible();
  await expect(page.locator('.landing')).toHaveCount(0);
  await page.getByRole('button', { name: /Search actions/ }).click();
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('.app')).toHaveClass(/theme-dark/);
  expect(external).toEqual([]);
});

test('reduced motion skips intro and floating effects while preserving keyboard file access', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.brand-intro')).toBeHidden();
  const paper = page.locator('.landing-preview');
  await expect(paper).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('heading', { name: 'Your PDFs, finally editable.' })).toBeVisible();
  await page.getByRole('button', { name: 'Open editor', exact: true }).focus();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  expect((await chooser).isMultiple()).toBe(false);
});

test('desktop landing preserves the reference layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const heading = (await page.locator('h1').boundingBox())!;
  const preview = (await page.locator('.landing-stage').boundingBox())!;
  expect(heading.x).toBe(230);
  expect(heading.y).toBe(217);
  expect(heading.width).toBe(980);
  expect(preview.x).toBe(210);
  expect(preview.width).toBe(1020);
  await expect(page.locator('.landing-card')).toHaveCount(6);
});

for (const width of [900, 390]) {
  test(`landing fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Your PDFs, finally editable.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open editor', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const heading = (await page.locator('h1').boundingBox())!;
    const preview = (await page.locator('.landing-stage').boundingBox())!;
    expect(heading.y + heading.height).toBeLessThan(preview.y);
    await page.locator('#privacy').scrollIntoViewIfNeeded();
    await expect(page.locator('#privacy button')).toBeInViewport();
  });
}

test('landing navigation, tour, documentation and privacy picker work locally', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('link', { name: 'Features', exact: true }).click();
  await expect(page.locator('#features')).toBeInViewport();
  await page.getByRole('link', { name: 'PDFForge', exact: true }).click();
  await page.getByRole('link', { name: 'Watch the tour', exact: true }).click();
  await expect(page.locator('#how-it-works')).toBeInViewport();
  await page.getByRole('link', { name: 'Privacy', exact: true }).first().click();
  await expect(page.locator('#privacy')).toBeInViewport();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#privacy button').click();
  expect((await chooser).isMultiple()).toBe(false);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Docs', exact: true }).last().click();
  expect((await download).suggestedFilename()).toBe('PDFForge-User-Guide.md');
});

test('landing reports invalid input and accepts a dropped PDF', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toHaveText('This file is not a valid PDF.');
  await expect(page.locator('.landing')).toBeVisible();
  await page.getByRole('alert').click();
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  const data = Array.from(await pdf.save());
  const transfer = await page.evaluateHandle((bytes) => {
    const value = new DataTransfer();
    value.items.add(new File([new Uint8Array(bytes)], 'dropped.pdf', { type: 'application/pdf' }));
    return value;
  }, data);
  await page.locator('.landing').dispatchEvent('dragover', { dataTransfer: transfer });
  await expect(page.getByRole('status')).toHaveText('Drop PDF to open');
  await page.locator('.landing').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByLabel('Rendered PDF pages')).toBeVisible();
  await expect(page.locator('.landing-drop')).toHaveCount(0);
  await transfer.dispose();
});
