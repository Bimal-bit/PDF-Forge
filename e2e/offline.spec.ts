import { expect, test } from '@playwright/test';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const base = 'http://127.0.0.1:4174';
let server: ChildProcess | undefined;

test.beforeAll(async () => {
  test.setTimeout(120000);
  await promisify(execFile)(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build'], { windowsHide: true });
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
  await expect.poll(async () => {
    try { return (await fetch(base)).ok; } catch { return false; }
  }, { timeout: 15000 }).toBe(true);
});

test.afterAll(() => { server?.kill(); });

test('reloads the production application and recovers edits offline', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith('blob:') && !url.startsWith('data:')) external.push(url);
  });
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Your PDFs, finally editable.' })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your PDFs, finally editable.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const guide = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Docs', exact: true }).first().click();
  expect((await guide).suggestedFilename()).toBe('PDFForge-User-Guide.md');
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]).drawText('Offline document', { x: 30, y: 300, font: await pdf.embedFont(StandardFonts.Helvetica), size: 16 });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'offline.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('.text-layer')).toHaveText('Offline document');
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Offline recovered edit');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Offline recovered edit');
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('.text-layer')).toHaveText('Offline document');
  expect(external).toEqual([]);
});

test('production theme changes preserve replacement-text paint', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]).drawText('PDFForge text fixture\nEdit this paragraph and export a copy.', { x: 48, y: 720, size: 18, font: await pdf.embedFont(StandardFonts.Helvetica), lineHeight: 26 });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'paint.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.locator('.text-layer span').filter({ hasText: 'PDFForge text fixture' }).dblclick();
  await page.getByLabel('Edit PDF text').fill('Verified editing at the original size.');
  await page.getByLabel('Find text in document').click();
  const box = (await page.locator('.text-object').boundingBox())!;
  const ink = async () => {
    const screenshot = await page.screenshot();
    return page.evaluate(async ({ bytes, box }) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close();
      const pixels = context.getImageData(box.x, box.y, box.width, box.height).data;
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 100 && pixels[index + 1] < 100 && pixels[index + 2] < 100) count += 1;
      return count;
    }, { bytes: [...screenshot], box });
  };
  const light = await ink();
  expect(light).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  expect(await ink()).toBe(light);
});
