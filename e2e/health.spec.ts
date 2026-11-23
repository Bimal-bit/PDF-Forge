import { runPageCommand } from './workspace-helpers';
import { expect, test, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';

async function open(page: Page, pdf: PDFDocument) {
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'health.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.locator('.text-layer')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Ribbon tabs' }).getByRole('button')).toHaveText(['Home', 'Insert', 'Layout', 'Review', 'View', 'Tools']);
}

async function downloaded(download: Download) { return readFile((await download.path())!); }

test('text selection follows the source geometry and zoom preserves the editing font size', async ({ page }) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const text = 'Select this complete line';
  pdf.addPage([300, 400]).drawText(text, { x: 30, y: 300, size: 24, font });
  await open(page, pdf);
  const run = page.locator('.text-layer span').filter({ hasText: text });
  await expect(run).toBeVisible();
  await expect.poll(async () => (await run.boundingBox())?.width ?? 0).toBeCloseTo(font.widthOfTextAtSize(text, 24), 0);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(async () => (await run.boundingBox())?.width ?? 0).toBeCloseTo(font.widthOfTextAtSize(text, 24) * 1.2, 0);
  await run.dblclick();
  await page.getByLabel('Edit PDF text').fill('Same size replacement');
  await page.getByLabel('Find text in document').click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('24');
});

test('text selection and in-place editing follow every page rotation', async ({ page }) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]).drawText('Rotating text', { x: 30, y: 300, size: 20, font: await pdf.embedFont(StandardFonts.Helvetica) });
  await open(page, pdf);
  const run = page.locator('.text-layer span').filter({ hasText: 'Rotating text' });
  await expect(run).toBeVisible();
  const canvas = page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas');
  const original = (await run.boundingBox())!;
  const sheet = (await canvas.boundingBox())!;
  const x = original.x - sheet.x; const y = original.y - sheet.y;
  const expected = [
    { x: 400 - y - original.height, y: x, width: original.height, height: original.width },
    { x: 300 - x - original.width, y: 400 - y - original.height, width: original.width, height: original.height },
    { x: y, y: 300 - x - original.width, width: original.height, height: original.width },
    { x, y, width: original.width, height: original.height },
  ];
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  for (const bounds of expected) {
    await runPageCommand(page, 'Rotate page');
    await expect.poll(async () => {
      const rect = (await run.boundingBox())!; const paper = (await canvas.boundingBox())!;
      return Math.abs(rect.x - paper.x - bounds.x) < 1 && Math.abs(rect.y - paper.y - bounds.y) < 1 && Math.abs(rect.width - bounds.width) < 1 && Math.abs(rect.height - bounds.height) < 1;
    }).toBe(true);
    await run.dblclick();
    await expect(page.getByLabel('Edit PDF text')).toHaveText('Rotating text');
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Edit PDF text')).toHaveCount(0);
  }
});

test('replacement text remains painted after a theme change and thumbnails keep their size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pdf = await PDFDocument.load(await readFile('fixtures/text.pdf'));
  await open(page, pdf);
  await page.locator('.text-layer span').filter({ hasText: 'PDFForge text fixture' }).dblclick();
  await page.getByLabel('Edit PDF text').fill('Verified editing at the original size.');
  await page.getByLabel('Find text in document').click();
  const text = page.locator('.text-object');
  const clip = (await text.boundingBox())!;
  const light = await page.screenshot({ clip });
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  expect((await page.screenshot({ clip })).equals(light)).toBe(true);
  await expect.poll(async () => (await page.getByLabel('Go to page 1', { exact: true }).boundingBox())!.height).toBeLessThan(200);
});

test('merging PDFs retains independently editable forms with colliding names', async ({ page }) => {
  const files = [];
  for (const value of ['First customer', 'Second customer']) {
    const pdf = await PDFDocument.create();
    const sheet = pdf.addPage([300, 400]);
    const field = pdf.getForm().createTextField('Customer');
    field.setText(value);
    field.addToPage(sheet, { x: 30, y: 200, width: 200, height: 24 });
    files.push({ name: `${files.length + 1}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  }
  const initial = await PDFDocument.create(); initial.addPage([300, 400]);
  await open(page, initial);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByLabel('Merge PDFs', { exact: true }).setInputFiles(files);
  const bytes = await downloaded(await pending);
  const result = await PDFDocument.load(bytes);
  expect(result.getPageCount()).toBe(2);
  const names = result.getForm().getFields().map((field) => field.getName());
  expect(names).toHaveLength(2);
  expect(new Set(names).size).toBe(2);
  expect(names.map((name) => result.getForm().getTextField(name).getText())).toEqual(['First customer', 'Second customer']);
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'merged.pdf', mimeType: 'application/pdf', buffer: bytes });
  await page.getByRole('button', { name: 'Detect form fields', exact: true }).click();
  await expect(page.getByLabel('Field value', { exact: true })).toHaveCount(2);
  await page.getByLabel('Field value', { exact: true }).nth(1).fill('Updated second customer');
  const edited = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const final = await PDFDocument.load(await downloaded(await edited));
  expect(final.getForm().getTextField(names[0]).getText()).toBe('First customer');
  expect(final.getForm().getTextField(names[1]).getText()).toBe('Updated second customer');
});

test('HTML import preserves block, line break, and table text boundaries', async ({ page }) => {
  const pdf = await PDFDocument.create(); pdf.addPage([300, 400]);
  await open(page, pdf);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByLabel('Import document', { exact: true }).setInputFiles({
    name: 'blocks.html', mimeType: 'text/html',
    buffer: Buffer.from('<h1>Heading</h1><p>First paragraph<br>Second line</p><p>Next <strong>important</strong> paragraph.</p><table><tr><td>Left</td><td>Right</td></tr></table><script>hidden script</script>'),
  });
  await expect(page.locator('.document-name')).toHaveText('blocks.pdf');
  await expect.poll(() => page.locator('.text-layer').innerText()).toMatch(/Heading\s+First paragraph\s+Second line\s+Next important paragraph\.\s+Left\s+Right/);
  await expect(page.locator('.text-layer')).not.toContainText('hidden script');
});

test('invalid PDF content does not replace the current edited document', async ({ page }) => {
  const pdf = await PDFDocument.create(); pdf.addPage([300, 400]);
  await open(page, pdf);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Keep this workspace');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nThis is not a PDF document.') });
  await expect(page.getByRole('alert')).toContainText('valid PDF');
  await expect(page.locator('.document-name')).toHaveText('health.pdf');
  await expect(page.getByLabel('Overlay text')).toHaveValue('Keep this workspace');
});
