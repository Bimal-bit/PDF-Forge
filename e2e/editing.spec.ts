import { runPageCommand } from './workspace-helpers';
import { expect, test, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFArray, PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';

async function open(page: Page, pdf: PDFDocument, name = 'editing.pdf') {
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  const paper = page.getByRole('article', { name: 'Page 1', exact: true });
  if ((page.viewportSize()?.width ?? 1440) <= 760) {
    await expect(paper).toHaveAttribute('data-rendered', 'true');
    expect((await paper.boundingBox())!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  } else await expect(paper.locator('canvas')).toHaveJSProperty('width', Math.ceil(pdf.getPage(0).getWidth() * 1.5));
}

async function blank() {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  return pdf;
}

async function downloaded(download: Download) { return PDFDocument.load(await readFile((await download.path())!)); }

function contents(pdf: PDFDocument, index: number) {
  const streams = pdf.getPage(index).node.Contents() as PDFArray;
  if (!streams) return '';
  return Array.from({ length: streams.size() }, (_, i) => new TextDecoder().decode(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode())).join('\n');
}

test('smart text match restyles current pages together with atomic undo and export', async ({ page }) => {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  pdf.addPage([400, 500]).drawText('First matching line', { x: 30, y: 400, size: 16, font: regular });
  pdf.addPage([400, 500]).drawText('Second matching line', { x: 30, y: 400, size: 16, font: regular });
  const different = pdf.addPage([400, 500]);
  different.drawText('Different weight', { x: 30, y: 400, size: 16, font: bold });
  different.drawText('Different family', { x: 30, y: 300, size: 16, font: mono });
  different.drawText('Different size', { x: 30, y: 200, size: 24, font: regular });
  await page.goto('/');
  await open(page, pdf);
  await page.locator('.text-layer span').filter({ hasText: 'First matching line' }).dblclick();
  await page.getByLabel('Find text in document').click();
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Move page down');
  await runPageCommand(page, 'Duplicate page');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Smart text match', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 blocks matched', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Overlay text')).toHaveCount(1);
  await page.getByLabel('Text color', { exact: true }).fill('#123456');
  await expect(page.getByLabel('Overlay text')).toHaveCount(2);
  await expect(page.locator('.text-object')).toHaveCount(3);
  for (const block of await page.locator('.text-object').all()) await expect(block).toHaveCSS('color', 'rgb(18, 52, 86)');
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveCount(1);
  await expect(page.getByLabel('Text color', { exact: true })).toHaveValue('#000000');
  await page.getByLabel('Redo', { exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveCount(2);
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await downloaded(await pending);
  expect(result.getPageCount()).toBe(4);
  for (const index of [0, 1, 2]) expect(contents(result, index)).toContain('0.07058823529411765');
  expect(contents(result, 3)).not.toContain('0.07058823529411765');
  await page.getByRole('button', { name: 'Smart text match', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 blocks matched', exact: true })).toBeVisible();
  await page.getByLabel('Font size', { exact: true }).fill('18');
  await expect(page.getByLabel('Overlay text')).toHaveCount(2);
  for (const block of await page.locator('.text-object').all()) await expect(block).toHaveCSS('font-size', '18px');
});

test('paragraph and character presets persist across files and preserve text', async ({ page }) => {
  await page.goto('/');
  await open(page, await blank());
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Style source');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByLabel('Font family', { exact: true }).selectOption('Courier');
  await page.getByLabel('Font size', { exact: true }).fill('20');
  await page.getByLabel('bold', { exact: true }).click();
  await page.getByLabel('Text alignment', { exact: true }).selectOption('right');
  await page.getByLabel('Line spacing', { exact: true }).fill('1.7');
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Styles & snippets' });
  await library.getByLabel('Library entry name').fill('Invoice heading');
  await library.getByRole('button', { name: 'Save selected style' }).click();
  await expect(library.getByRole('status')).toHaveText('Invoice heading saved in this browser.');
  await library.getByLabel('Preset type').selectOption('character');
  await library.getByLabel('Library entry name').fill('Invoice emphasis');
  await library.getByRole('button', { name: 'Save selected style' }).click();
  await expect(library.getByRole('status')).toHaveText('Invoice emphasis saved in this browser.');
  await page.keyboard.press('Escape');
  await expect(library).toHaveCount(0);
  await open(page, await blank(), 'second.pdf');
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Keep the second file text');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  await library.getByRole('button', { name: 'Apply Invoice heading', exact: true }).click();
  await library.getByLabel('Close editing library').click();
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('Courier');
  await expect(page.getByLabel('Text alignment', { exact: true })).toHaveValue('right');
  await expect(page.getByLabel('Line spacing', { exact: true })).toHaveValue('1.7');
  await expect(page.getByLabel('Overlay text')).toHaveValue('Keep the second file text');
  await page.getByLabel('Text alignment', { exact: true }).selectOption('left');
  await page.getByLabel('Line spacing', { exact: true }).fill('1.2');
  await page.getByLabel('Font size', { exact: true }).fill('14');
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  await library.getByRole('button', { name: 'Apply Invoice emphasis', exact: true }).click();
  await library.getByLabel('Close editing library').click();
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('20');
  await expect(page.getByLabel('Text alignment', { exact: true })).toHaveValue('left');
  await expect(page.getByLabel('Line spacing', { exact: true })).toHaveValue('1.2');
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  expect(contents(await downloaded(await pending), 0)).toContain('20 Tf');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Keep the second file text');
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Apply Invoice emphasis', exact: true })).toBeVisible();
  await library.getByRole('button', { name: 'Delete Invoice heading', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Apply Invoice heading', exact: true })).toHaveCount(0);
  await library.getByLabel('Close editing library').click();
  await page.reload();
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Apply Invoice heading', exact: true })).toHaveCount(0);
  await expect(library.getByRole('button', { name: 'Apply Invoice emphasis', exact: true })).toBeVisible();
});

test('snippets insert at chosen coordinates on reordered pages and survive recovery', async ({ page }) => {
  const pdf = await blank(); pdf.addPage([300, 400]);
  await page.goto('/');
  await open(page, pdf);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Move page down');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Styles & snippets' });
  await library.getByRole('button', { name: 'Snippets', exact: true }).click();
  await library.getByLabel('Library entry name').fill('Office address');
  await library.getByLabel('Snippet text').fill('12 Paper Lane\nSample City');
  await library.getByRole('button', { name: 'Save snippet', exact: true }).click();
  await expect(library.getByRole('status')).toHaveText('Office address saved in this browser.');
  await library.getByLabel('Snippet x', { exact: true }).fill('30');
  await library.getByLabel('Snippet y', { exact: true }).fill('180');
  await library.getByLabel('Snippet width', { exact: true }).fill('160');
  await library.getByRole('button', { name: 'Insert Office address', exact: true }).click();
  await library.getByLabel('Close editing library').click();
  await expect(page.getByRole('article', { name: 'Page 2', exact: true }).locator('.text-object')).toHaveText('12 Paper Lane\nSample City');
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(0);
  await page.getByLabel('Redo', { exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCSS('left', '30px');
  await expect(page.locator('.text-object')).toHaveCSS('bottom', '180px');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await expect(page.getByLabel('Overlay text')).toHaveValue('12 Paper Lane\nSample City');
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await downloaded(await pending);
  expect(contents(result, 0)).not.toContain('5061706572');
  expect(contents(result, 1)).toContain('3132205061706572204C616E65');
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  await library.getByRole('button', { name: 'Snippets', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Insert Office address', exact: true })).toBeVisible();
});

test('failed library saves preserve the input for retry', async ({ page }) => {
  await page.goto('/');
  await open(page, await blank());
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Styles & snippets' });
  await library.getByRole('button', { name: 'Snippets', exact: true }).click();
  await library.getByLabel('Library entry name').fill('Retry snippet');
  await library.getByLabel('Snippet text').fill('Keep this input');
  await expect(library.getByRole('button', { name: 'Save snippet', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
    Reflect.set(window, 'restoreLibraryStorage', () => { IDBFactory.prototype.open = original; });
  });
  await library.getByRole('button', { name: 'Save snippet', exact: true }).click();
  await expect(library.getByRole('status')).toContainText('could not be saved');
  await expect(library.getByLabel('Library entry name')).toHaveValue('Retry snippet');
  await expect(library.getByLabel('Snippet text')).toHaveValue('Keep this input');
  await page.evaluate(() => Reflect.get(window, 'restoreLibraryStorage')());
  await library.getByRole('button', { name: 'Save snippet', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Insert Retry snippet', exact: true })).toBeVisible();
});

test('upgrades existing recovery records while adding the local library', async ({ page }) => {
  const source = await blank();
  await page.route('**/legacy-storage', (route) => route.fulfill({ contentType: 'text/html', body: '<html><body>Legacy storage fixture</body></html>' }));
  await page.goto('/legacy-storage');
  await page.evaluate(async (bytes) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('pdfforge', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('documents');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('documents', 'readwrite');
        transaction.objectStore('documents').put({ id: 'legacy', name: 'legacy.pdf', size: bytes.length, modifiedAt: 1, data: new Uint8Array(bytes).buffer, objects: [{ id: 'legacy-text', type: 'text', page: 1, text: 'Recovered before upgrade', x: 30, y: 300, fontSize: 12, color: '#000000' }] }, 'legacy');
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, Array.from(await source.save()));
  await page.goto('/');
  await expect(page.getByLabel('Overlay text')).toHaveValue('Recovered before upgrade');
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Styles & snippets' });
  await library.getByLabel('Library entry name').fill('Recovered style');
  await library.getByRole('button', { name: 'Save selected style', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Apply Recovered style', exact: true })).toBeVisible();
});

for (const width of [1440, 900, 390]) {
  test(`editing library keeps its form readable at ${width}px with keyboard dismissal`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/');
    await open(page, await blank());
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
    if (width <= 760) await page.getByLabel('Mobile workspace').getByRole('button', { name: 'Inspector', exact: true }).click();
    await page.getByLabel('Overlay text').fill('Saved from selected text');
    if (width <= 760) await page.getByRole('button', { name: 'Hide properties panel', exact: true }).click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    const trigger = page.getByRole('button', { name: 'Styles & snippets', exact: true });
    await trigger.click();
    const library = page.getByRole('dialog', { name: 'Styles & snippets' });
    await library.getByRole('button', { name: 'Snippets', exact: true }).click();
    await library.getByRole('button', { name: 'Use selected text', exact: true }).click();
    await expect(library.getByLabel('Snippet text')).toHaveValue('Saved from selected text');
    await expect(library.getByLabel('Snippet text')).toHaveCSS('min-height', '100px');
    const textBox = (await library.getByLabel('Snippet text').boundingBox())!;
    const copyButton = (await library.getByRole('button', { name: 'Use selected text', exact: true }).boundingBox())!;
    expect(copyButton.y).toBeGreaterThanOrEqual(textBox.y + textBox.height);
    expect(await library.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(library).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}
