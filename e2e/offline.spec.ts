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
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByLabel('Font size', { exact: true }).fill('16');
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Styles & snippets' });
  await library.getByLabel('Library entry name').fill('Offline style');
  await library.getByRole('button', { name: 'Save selected style', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Apply Offline style', exact: true })).toBeVisible();
  await library.getByRole('button', { name: 'Snippets', exact: true }).click();
  await library.getByLabel('Library entry name').fill('Offline snippet');
  await library.getByLabel('Snippet text').fill('Offline reusable text');
  await library.getByRole('button', { name: 'Save snippet', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Insert Offline snippet', exact: true })).toBeVisible();
  await library.getByLabel('Close editing library').click();
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Offline recovered edit');
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('.text-layer')).toHaveText('Offline document');
  await page.getByRole('button', { name: 'Smart text match', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 blocks matched', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  await library.getByRole('button', { name: 'Apply Offline style', exact: true }).click();
  await library.getByRole('button', { name: 'Snippets', exact: true }).click();
  await library.getByRole('button', { name: 'Insert Offline snippet', exact: true }).click();
  await library.getByLabel('Close editing library').click();
  await expect(page.getByLabel('Overlay text')).toHaveCount(3);
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

test('advanced editing and review recover and export offline without external requests', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith(base) && !/^(blob:|data:)/.test(request.url())) external.push(request.url()); });
  await page.goto(base);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  const source = await PDFDocument.create(); source.addPage([500, 650]);
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'offline-layout.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await source.save()) });
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Tracked changes' });
  await review.getByLabel('Track text changes').check();
  await review.getByLabel('Change author').fill('Offline editor');
  await review.getByLabel('Close Tracked changes').click();
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: 'Text flow & columns', exact: true }).click();
  const layout = page.getByRole('dialog', { name: 'Text flow & columns' });
  await layout.getByRole('button', { name: 'Add text box', exact: true }).click();
  await layout.getByLabel('Text box content').fill('Offline columns and a drop cap stay editable.');
  await layout.getByLabel('Text frame width', { exact: true }).fill('300');
  await layout.getByLabel('Text columns').selectOption('2');
  await layout.getByLabel('Drop cap', { exact: true }).selectOption('2');
  await layout.getByLabel('Close Text flow & columns').click();
  await page.getByRole('button', { name: 'Equation editor', exact: true }).click();
  const math = page.getByRole('dialog', { name: 'Equation editor' });
  await math.getByLabel('Equation LaTeX').fill('\\frac{x^2}{\\pi}');
  await math.getByRole('button', { name: 'Insert equation', exact: true }).click();
  await math.getByLabel('Close Equation editor').click();
  await page.getByRole('button', { name: 'Shapes & connectors', exact: true }).click();
  const diagram = page.getByRole('dialog', { name: 'Shapes & connectors' });
  await diagram.getByRole('button', { name: 'Add flowchart shape', exact: true }).click();
  await diagram.getByLabel('Shape label').fill('Offline shape');
  await diagram.getByLabel('Close Shapes & connectors').click();
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80;
    const drawing = canvas.getContext('2d')!; drawing.fillStyle = '#f00'; drawing.fillRect(0, 0, 80, 80);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByLabel('Add image', { exact: true }).setInputFiles({ name: 'offline.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: 'Image tools', exact: true }).click();
  const images = page.getByRole('dialog', { name: 'Image tools' });
  await images.getByLabel('Image mask').selectOption('ellipse');
  await images.getByRole('button', { name: 'Apply image edits', exact: true }).click();
  await expect(images.getByRole('status')).toContainText('Image edits applied');
  await images.getByLabel('Close Image tools').click();
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await expect(page.locator('.flow-text-object')).toHaveCount(1);
  await expect(page.locator('.equation-object')).toHaveCount(1);
  await expect(page.locator('.image-object')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Move shape Offline shape', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  await expect(review.getByRole('list', { name: 'Text changes' })).toContainText('Offline editor');
  await review.getByRole('button', { name: 'Accept change', exact: true }).click();
  await review.getByLabel('Close Tracked changes').click();
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  expect((await pending).suggestedFilename()).toBe('offline-layout-edited.pdf');
  expect(external).toEqual([]);
});
