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
