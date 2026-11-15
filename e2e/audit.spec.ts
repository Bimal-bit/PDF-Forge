import { expect, test, type Page, type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream, StandardFonts } from 'pdf-lib';

async function openDocument(page: Page, count = 2) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 1; index <= count; index += 1) {
    pdf.addPage([300, 400]).drawText(`Source page ${index}`, { x: 30, y: 300, size: 16, font });
  }
  await page.goto('/');
  const started = Date.now();
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'audit.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByLabel('Go to page 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas')).toHaveJSProperty('width', 450);
  return Date.now() - started;
}

async function downloadedPdf(download: Download) {
  return PDFDocument.load(await readFile((await download.path())!));
}

function pageContent(pdf: PDFDocument, index: number) {
  const contents = pdf.getPage(index).node.Contents();
  const streams = contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i, PDFRawStream)) : [contents as PDFRawStream];
  return streams.map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode())).join('\n');
}

test('recovers objects and the page plan after an autosave and refresh', async ({ page }) => {
  await openDocument(page);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Recovered edit');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByLabel('Watermark', { exact: true }).fill('DRAFT');
  await page.getByRole('button', { name: 'Duplicate page', exact: true }).click();
  await expect(page.getByLabel('Go to page 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Recovered edit');
  await expect(page.getByLabel('Go to page 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(page.getByLabel('Watermark', { exact: true })).toHaveValue('DRAFT');
});

test('edits the original source page after reordering and reparses the export', async ({ page }) => {
  await openDocument(page);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Move page down', exact: true }).click();
  await page.getByLabel('Go to page 1', { exact: true }).click();
  const text = page.getByRole('article', { name: 'Page 1', exact: true }).locator('.text-layer span').filter({ hasText: 'Source page 2' });
  await text.dblclick();
  await page.getByLabel('Edit PDF text').fill('Replacement');
  await page.getByLabel('Find text in document').click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Replacement');
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await downloadedPdf(await pending);
  expect(pageContent(pdf, 0)).toContain('5265706C6163656D656E74');
  expect(pageContent(pdf, 1)).not.toContain('5265706C6163656D656E74');
});

test('exports filled fields and typed signatures after duplicating a page', async ({ page }) => {
  await openDocument(page, 1);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text field', exact: true }).click();
  await page.getByLabel('Field value', { exact: true }).fill('Ada');
  await page.getByRole('button', { name: 'Add signature field', exact: true }).click();
  await page.getByLabel('Signer name', { exact: true }).fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate page', exact: true }).click();
  await expect(page.getByLabel('Go to page 2', { exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await downloadedPdf(await pending);
  expect(pdf.getForm().getFields()).toHaveLength(2);
  expect(pdf.getForm().getTextField(pdf.getForm().getFields()[0].getName()).getText()).toBe('Ada');
  expect(pageContent(pdf, 1)).toContain('416461204C6F76656C616365');
});

test('filters command palette actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Open a PDF to begin' })).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByLabel('Search commands').fill('accessibility');
  await expect(page.getByRole('dialog').getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Check accessibility' })).toBeVisible();
});

test('imports escaped annotation text twice and removes just one copy', async ({ page }) => {
  await openDocument(page, 1);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const file = { name: 'annotations.xfdf', mimeType: 'application/vnd.adobe.xfdf+xml', buffer: Buffer.from('<xfdf><annots><note id="shared" page="1" x="20" y="30" author="A &amp; &quot;B&quot;">Literal &amp;lt;tag&amp;gt;</note></annots></xfdf>') };
  await page.getByLabel('Import PDFForge XFDF').setInputFiles(file);
  await expect(page.getByLabel('Annotation author')).toHaveValue('A & "B"');
  await expect(page.getByLabel('Annotation comment')).toHaveValue('Literal &lt;tag&gt;');
  await page.getByLabel('Import PDFForge XFDF').setInputFiles(file);
  await expect(page.getByLabel('Annotation comment')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove', exact: true }).first().click();
  await expect(page.getByLabel('Annotation comment')).toHaveCount(1);
});

test('mail merges a multiline quoted CSV cell into an exported form', async ({ page }) => {
  await openDocument(page, 1);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text field', exact: true }).click();
  await page.getByLabel('Field value', { exact: true }).fill('{{address}}');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByLabel('Mail merge CSV').setInputFiles({ name: 'recipients.csv', mimeType: 'text/csv', buffer: Buffer.from('name,address\nAda,"First line\nSecond line"') });
  const pdf = await downloadedPdf(await pending);
  const field = pdf.getForm().getFields()[0];
  expect(pdf.getForm().getTextField(field.getName()).getText()).toBe('First line\nSecond line');
  await expect(page.getByText('1 recipient PDFs generated locally.')).toBeVisible();
});

test('opens a 300-page PDF without starting a worker for every thumbnail', async ({ page }, testInfo) => {
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  const elapsed = await openDocument(page, 300);
  testInfo.annotations.push({ type: 'first-page-ms', description: String(elapsed) });
  expect(workers.length).toBeLessThanOrEqual(2);
  await page.getByLabel('Go to page 300', { exact: true }).click();
  await expect(page.getByRole('article', { name: 'Page 300', exact: true }).locator('.text-layer')).toContainText('Source page 300');
});

test('redacts through the UI and verifies every embedded stream', async ({ page }) => {
  await openDocument(page, 1);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByLabel('Redact text', { exact: true }).fill('Source page');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export redacted copy', exact: true }).click();
  const pdf = await downloadedPdf(await pending);
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream) {
      const stream = new TextDecoder().decode(decodePDFRawStream(object).decode());
      expect(stream).not.toContain('536F757263652070616765');
      expect(stream).not.toContain('Source page');
    }
  }
  await expect(page.getByText('Redacted copy verified and downloaded.')).toBeVisible();
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'redacted.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('.text-layer')).toHaveText('');
});

test('renders the workspace at tablet width', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openDocument(page);
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas')).toHaveJSProperty('width', 450);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('workspace.png') });
});
