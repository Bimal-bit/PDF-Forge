import { runPageCommand } from './workspace-helpers';
import { expect, test, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFArray, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';

async function open(page: Page, source?: PDFDocument) {
  const pdf = source ?? await PDFDocument.create();
  if (!source) {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const text of ['First source', 'Second source']) pdf.addPage([300, 400]).drawText(text, { x: 30, y: 300, size: 16, font });
  }
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'regression.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas')).toHaveJSProperty('width', Math.ceil(pdf.getPage(0).getWidth() * 1.5));
}

async function downloaded(download: Download) { return readFile((await download.path())!); }

function contents(pdf: PDFDocument, index: number) {
  const streams = pdf.getPage(index).node.Contents() as PDFArray;
  return Array.from({ length: streams.size() }, (_, i) => new TextDecoder().decode(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode())).join('\n');
}

test('optimization retains edits, rotation, and the page plan', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Keep this edit');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Rotate page');
  await runPageCommand(page, 'Move page down');
  await runPageCommand(page, 'Duplicate page');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Optimize PDF', exact: true }).click();
  const pdf = await PDFDocument.load(await downloaded(await pending));
  expect(pdf.getPageCount()).toBe(3);
  expect(pdf.getPage(1).getRotation().angle).toBe(90);
  expect(contents(pdf, 1)).toContain('4B65657020746869732065646974');
  expect(contents(pdf, 2)).toContain('4B65657020746869732065646974');
});

test('search follows replacement text and inserted links after page changes', async ({ page }) => {
  await open(page);
  await page.locator('.text-layer span').filter({ hasText: 'First source' }).dblclick();
  await page.getByLabel('Edit PDF text').fill('Visible replacement');
  await page.getByLabel('Find text in document').click();
  await page.getByLabel('Find text in document').fill('First source');
  await expect(page.locator('.search-box')).toContainText('0 matches');
  await page.getByLabel('Find text in document').fill('Visible replacement');
  await expect(page.locator('.search-box')).toContainText('1 match');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Move page down');
  await expect(page.locator('.search-box')).toContainText('Go to page 2');
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add link', exact: true }).click();
  await page.getByLabel('Link destination', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: 'Insert link', exact: true }).click();
  await page.getByLabel('Find text in document').fill('example.com');
  await expect(page.locator('.search-box')).toContainText('1 match');
});

test('existing form selections and maximum length can be cleared', async ({ page }) => {
  const source = await PDFDocument.create(); const sheet = source.addPage([300, 400]);
  const form = source.getForm();
  const dropdown = form.createDropdown('Choice'); dropdown.addOptions(['Yes', 'No']); dropdown.select('Yes'); dropdown.addToPage(sheet, { x: 30, y: 200, width: 120, height: 20 });
  const list = form.createOptionList('List'); list.addOptions(['Yes', 'No']); list.select('Yes'); list.addToPage(sheet, { x: 30, y: 150, width: 120, height: 40 });
  const radio = form.createRadioGroup('Radio'); radio.addOptionToPage('Yes', sheet, { x: 30, y: 120, width: 18, height: 18 }); radio.select('Yes');
  const text = form.createTextField('Text'); text.setMaxLength(5); text.setText('Short'); text.addToPage(sheet, { x: 30, y: 80, width: 120, height: 20 });
  await open(page, source);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Detect form fields', exact: true }).click();
  await expect(page.getByLabel('Selected field value')).toHaveCount(3);
  for (const select of await page.getByLabel('Selected field value').all()) await select.selectOption('');
  await expect(page.getByLabel('Field maximum length')).toHaveValue('5');
  await page.getByLabel('Field maximum length').fill('');
  await page.getByLabel('Field value', { exact: true }).last().fill('Longer than five');
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const result = (await PDFDocument.load(await downloaded(await pending))).getForm();
  expect(result.getDropdown('Choice').getSelected()).toEqual([]);
  expect(result.getOptionList('List').getSelected()).toEqual([]);
  expect(result.getRadioGroup('Radio').getSelected()).toBeUndefined();
  expect(result.getTextField('Text').getMaxLength()).toBeUndefined();
  expect(result.getTextField('Text').getText()).toBe('Longer than five');
});

test('comparison and accessibility inspect the edited page plan', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Delete page');
  await page.getByRole('button', { name: 'Check accessibility', exact: true }).click();
  await expect(page.getByLabel('Accessibility report')).toContainText('1 pages');
  await page.getByLabel('Close panel', { exact: true }).click();
  const other = await PDFDocument.create(); other.addPage([300, 400]).drawText('Second source', { x: 30, y: 300, size: 16, font: await other.embedFont(StandardFonts.Helvetica) });
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Compare PDF', exact: true }).click();
  await (await picker).setFiles({ name: 'other.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await other.save()) });
  await expect(page.getByRole('alert')).toHaveText('No extracted text differences found.');
  other.addPage([300, 400]);
  const blankPicker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Compare PDF', exact: true }).click();
  await (await blankPicker).setFiles({ name: 'extra-blank.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await other.save()) });
  await expect(page.getByRole('alert')).toHaveText('1 page contain text changes.');
});

test('comparison uses the same reading order for both documents', async ({ page }) => {
  const source = await PDFDocument.create();
  const sheet = source.addPage([300, 400]);
  const font = await source.embedFont(StandardFonts.Helvetica);
  sheet.drawText('Bottom line drawn first', { x: 30, y: 100, size: 12, font });
  sheet.drawText('Top line drawn second', { x: 30, y: 300, size: 12, font });
  await open(page, source);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Compare PDF', exact: true }).click();
  await (await picker).setFiles({ name: 'same.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await source.save()) });
  await expect(page.getByRole('alert')).toHaveText('No extracted text differences found.');
});

test('table exports include inserted tables in output page order', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add table', exact: true }).click();
  await page.getByRole('button', { name: 'Insert table', exact: true }).click();
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Move page down');
  await runPageCommand(page, 'Duplicate page');
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Extract tables CSV', exact: true }).click();
  const csv = (await downloaded(await csvDownload)).toString('utf8');
  expect(csv).toContain('# Page 2\n"Header 1","Header 2"');
  expect(csv).toContain('# Page 3\n"Header 1","Header 2"');
  const xlsxDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export XLSX', exact: true }).click();
  const archive = unzipSync(await downloaded(await xlsxDownload));
  expect(strFromU8(archive['xl/workbook.xml'])).toContain('name="Page 2 Table 1"');
  expect(strFromU8(archive['xl/workbook.xml'])).toContain('name="Page 3 Table 2"');
  expect(strFromU8(archive['xl/worksheets/sheet1.xml'])).toContain('Header 1');
});

test('exports Unicode repeating marks with the local font', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByLabel('Header', { exact: true }).fill('Ελληνικά {page}');
  await page.getByLabel('Footer', { exact: true }).fill('Копия');
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const data = await downloaded(await pending);
  expect((await PDFDocument.load(data)).getPageCount()).toBe(2);
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'unicode.pdf', mimeType: 'application/pdf', buffer: data });
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('.text-layer')).toContainText('Ελληνικά 1');
  await expect(page.getByRole('article', { name: 'Page 2', exact: true }).locator('.text-layer')).toContainText('Копия');
});

test('recovery scrolls to the saved selected page after the PDF loads', async ({ page }) => {
  await open(page);
  await page.getByLabel('Go to page 2', { exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await expect(page.getByLabel('Go to page 2', { exact: true })).toHaveClass(/active/);
  await expect.poll(() => page.getByRole('article', { name: 'Page 2', exact: true }).evaluate((element) => {
    const canvas = element.closest('.canvas')!.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return rect.top >= canvas.top - 1 && rect.top < canvas.bottom && (rect.height > canvas.height || rect.bottom <= canvas.bottom + 1);
  })).toBe(true);
});

test('OCR preserves edits made while recognition is running', async ({ page }) => {
  test.setTimeout(60000);
  const source = await PDFDocument.load(await readFile('fixtures/scanned.pdf'));
  await open(page, source);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Before recognition');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Offline OCR', exact: true }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/ocr/worker.min.js', async (route) => { await gate; await route.continue(); });
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  try {
    await expect(page.getByRole('button', { name: 'Cancel OCR', exact: true })).toBeVisible();
    // OCR is a modal dialog. Simulate a concurrent workspace mutation through the store.
    await page.evaluate(async () => { const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState(); state.updateTextObject(state.objects[0].id, 'Keep the edit made during OCR'); });
  } finally { release(); }
  await expect(page.getByRole('alert')).toContainText('No OCR results were applied', { timeout: 45000 });
  await page.getByRole('button', { name: 'Close Offline OCR', exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Keep the edit made during OCR');
  await page.getByRole('button', { name: 'Offline OCR', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recognize document', exact: true })).toBeEnabled();
});
