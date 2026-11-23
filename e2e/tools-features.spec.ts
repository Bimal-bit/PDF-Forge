import { runPageCommand } from './workspace-helpers';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { downloadPdf, openAdvanced, pageStreams } from './advanced-helpers';

async function tools(page: Page) { await page.getByRole('button', { name: 'Tools', exact: true }).click(); }
async function compare(page: Page, bytes: Uint8Array, name = 'revised.pdf') {
  const picker = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Compare PDF', exact: true }).click();
  await (await picker).setFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
}

test('Extract pages preserves displayed page order, edits, repeated pages, rotation, and marks', async ({ page }) => {
  await openAdvanced(page, 3, 'Source'); await page.getByLabel('Go to page 3', { exact: true }).click();
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text', { exact: true }).fill('Range overlay'); await tools(page);
  await page.getByLabel('Header', { exact: true }).fill('Display {page}'); await page.getByLabel('Bates start', { exact: true }).fill('10');
  await runPageCommand(page, 'Duplicate page'); await runPageCommand(page, 'Rotate page');
  await page.getByRole('button', { name: 'Extract pages', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Extract pages', exact: true });
  await dialog.getByLabel('Pages to extract', { exact: true }).fill('4,2-1,4');
  await expect(dialog.getByLabel('Extraction preview')).toContainText('4 output pages: 4, 2, 1, 4');
  const pending = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Download extracted PDF', exact: true }).click();
  const output = await downloadPdf(await pending);
  expect(output.getPageCount()).toBe(4); expect(output.getPages().map((sheet) => sheet.getRotation().angle)).toEqual([90, 0, 0, 90]);
  expect(pageStreams(output, 0)).toContain('446973706C61792034'); expect(pageStreams(output, 1)).toContain('446973706C61792032');
  expect(pageStreams(output, 3)).toContain('52616E6765206F7665726C6179');
  await expect(dialog).not.toBeVisible(); await expect(page.getByLabel('Overlay text', { exact: true })).toHaveValue('Range overlay');
  await expect(page.locator('.tools-context')).toContainText('of 4');
});

test('range presets, validation, descending pages, and stale-document rejection keep extraction reviewable', async ({ page }) => {
  await openAdvanced(page, 3); await tools(page); await page.getByRole('button', { name: 'Extract pages', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Extract pages', exact: true }), input = dialog.getByLabel('Pages to extract', { exact: true });
  await dialog.getByRole('button', { name: 'All pages', exact: true }).click(); await expect(input).toHaveValue('1-3');
  await dialog.getByRole('button', { name: 'Odd pages', exact: true }).click(); await expect(input).toHaveValue('1, 3');
  await dialog.getByRole('button', { name: 'Even pages', exact: true }).click(); await expect(input).toHaveValue('2');
  await dialog.getByRole('button', { name: 'Current page', exact: true }).click(); await expect(input).toHaveValue('1');
  await input.fill('1,'.repeat(501)); await expect(dialog.getByRole('alert')).toContainText('1000 characters');
  await input.fill('0,4'); await expect(dialog.getByRole('alert')).toContainText('between 1 and 3');
  await expect(dialog.getByRole('button', { name: 'Download extracted PDF', exact: true })).toBeDisabled();
  await input.fill('3-1'); await expect(dialog.getByLabel('Extraction preview')).toContainText('3, 2, 1');
  await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().duplicatePage());
  await dialog.getByRole('button', { name: 'Download extracted PDF', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('changed');
  await page.setViewportSize({ width: 390, height: 844 }); expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).not.toBeVisible();
});

test('closing Extract pages discards a delayed font-dependent export', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click(); await page.getByLabel('Overlay text', { exact: true }).fill('Γειά'); await tools(page);
  let release: (() => Promise<void>) | undefined;
  await page.route('**/fonts/NotoSans-Regular.ttf', async (route) => { await new Promise<void>((resolve) => { release = async () => { await route.continue(); resolve(); }; }); });
  const downloads: string[] = []; page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Extract pages', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Extract pages', exact: true });
  await dialog.getByRole('button', { name: 'Download extracted PDF', exact: true }).click(); await expect.poll(() => Boolean(release)).toBe(true);
  await dialog.getByLabel('Close Extract pages', { exact: true }).click(); await expect(dialog).not.toBeVisible();
  const response = page.waitForResponse('**/fonts/NotoSans-Regular.ttf'); await release!(); await response;
  await page.waitForTimeout(500); expect(downloads).toEqual([]);
});

test('comparison report shows page differences, downloads JSON, and navigates to current text', async ({ page }) => {
  await openAdvanced(page, 2, 'alpha beta'); await tools(page);
  const other = await PDFDocument.create(), font = await other.embedFont(StandardFonts.Helvetica);
  other.addPage([500, 650]).drawText('alpha gamma', { x: 40, y: 550, size: 12, font });
  other.addPage([500, 650]).drawText('alpha beta', { x: 40, y: 550, size: 12, font });
  await compare(page, await other.save()); await expect(page.locator('.notice')).toContainText('1 page contain text changes.');
  await page.getByRole('button', { name: 'Comparison report', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Comparison report', exact: true });
  await expect(dialog).toContainText('advanced.pdf compared with revised.pdf'); await expect(dialog.getByRole('list', { name: 'Compared pages' }).locator('li')).toHaveCount(1);
  await expect(dialog).toContainText('gamma'); await expect(dialog).toContainText('beta');
  const pending = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Download comparison report', exact: true }).click();
  const data = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(data.changedPages).toBe(1); expect(data.pages[0]).toMatchObject({ added: ['gamma'], removed: ['beta'] });
  await dialog.getByLabel('Show changed pages only').uncheck(); await expect(dialog.getByRole('list', { name: 'Compared pages' }).locator('li')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 }); expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole('button', { name: 'Go to current page 2', exact: true }).click(); await expect(dialog).not.toBeVisible();
  await page.getByLabel('Mobile workspace').getByRole('button', { name: 'Pages', exact: true }).click();
  await expect(page.getByLabel('Go to page 2', { exact: true })).toHaveAttribute('aria-current', 'page');
});

test('a comparison with no changes has a complete inspectable report', async ({ page }) => {
  await openAdvanced(page, 1, 'alpha beta'); await tools(page);
  const same = await PDFDocument.create(); same.addPage([500, 650]).drawText('alpha beta', { x: 40, y: 550, size: 12 });
  await compare(page, await same.save(), 'same.pdf'); await expect(page.locator('.notice')).toHaveText('No extracted text differences found.');
  await page.getByRole('button', { name: 'Comparison report', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Comparison report', exact: true });
  await expect(dialog).toContainText('No changed pages'); await dialog.getByLabel('Show changed pages only').uncheck(); await expect(dialog).toContainText('Same extracted text');
  await dialog.getByLabel('Close Comparison report', { exact: true }).click();
  await runPageCommand(page, 'Rotate page'); await expect(page.getByRole('button', { name: 'Comparison report', exact: true })).toHaveCount(0);
});

test('invalid form values reject the entire import and valid data retains options through export', async ({ page }) => {
  const pdf = await PDFDocument.create(), sheet = pdf.addPage([500, 650]);
  const name = pdf.getForm().createTextField('Name'); name.setText('Ada'); name.setMaxLength(3); name.addToPage(sheet, { x: 40, y: 500, width: 150, height: 24 });
  const choice = pdf.getForm().createDropdown('Choice'); choice.addOptions(['Yes', 'No']); choice.select('Yes'); choice.addToPage(sheet, { x: 40, y: 450, width: 150, height: 24 });
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'form-options.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) }); await tools(page);
  await page.getByRole('button', { name: 'Detect form fields', exact: true }).click(); await expect(page.getByLabel('Field value', { exact: true })).toHaveCount(1); await expect(page.getByLabel('Selected field value', { exact: true })).toHaveCount(1);
  await page.getByLabel('Import form data', { exact: true }).setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"Name":"Bea","Choice":"Invalid"}') });
  await expect(page.locator('.notice')).toContainText('available option'); await expect(page.getByLabel('Field value', { exact: true }).first()).toHaveValue('Ada');
  await page.getByLabel('Import form data', { exact: true }).setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from('{"Name":"Bea","Choice":""}') });
  await expect(page.getByLabel('Field value', { exact: true }).first()).toHaveValue('Bea'); await expect(page.getByLabel('Selected field value', { exact: true })).toHaveValue('');
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); const output = await downloadPdf(await pending);
  expect(output.getForm().getTextField('Name').getText()).toBe('Bea'); expect(output.getForm().getDropdown('Choice').getSelected()).toEqual([]);
  await page.getByLabel('Undo', { exact: true }).click(); await expect(page.getByLabel('Field value', { exact: true }).first()).toHaveValue('Ada'); await expect(page.getByLabel('Selected field value', { exact: true })).toHaveValue('Yes');
});

test('protected packages round-trip current edits and retry the same file after a wrong password', async ({ page }) => {
  await openAdvanced(page, 1, 'Package source'); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click(); await page.getByLabel('Overlay text', { exact: true }).fill('Saved package text'); await tools(page);
  await page.getByLabel('Package password', { exact: true }).fill('test-password'); const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export protected package', exact: true }).click(); const encrypted = await readFile((await (await pending).path())!);
  await expect(page.getByLabel('Package password', { exact: true })).toHaveValue('');
  await page.getByLabel('Overlay text', { exact: true }).fill('Current newer edit');
  page.once('dialog', (dialog) => void dialog.accept('wrong-password')); await page.getByLabel('Open protected package', { exact: true }).setInputFiles({ name: 'saved.pdfg', mimeType: 'application/octet-stream', buffer: encrypted });
  await expect(page.locator('.notice')).toContainText('Could not open'); await expect(page.getByLabel('Overlay text', { exact: true })).toHaveValue('Current newer edit');
  page.once('dialog', (dialog) => void dialog.accept('test-password')); await page.getByLabel('Open protected package', { exact: true }).setInputFiles({ name: 'saved.pdfg', mimeType: 'application/octet-stream', buffer: encrypted });
  await expect(page.locator('.document-name')).toHaveText('saved.pdf'); await expect(page.locator('.text-layer').first()).toContainText('Saved package text');
});

test('empty XLSX export reports no candidates and image export refuses a mislabeled encoder fallback', async ({ page }) => {
  await openAdvanced(page); await tools(page); const downloads: string[] = []; page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Export XLSX', exact: true }).click(); await expect(page.locator('.notice')).toContainText('No multi-run text table'); expect(downloads).toEqual([]);
  await page.evaluate(() => { const encode = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function (callback) { encode.call(this, callback, 'image/png'); }; });
  await page.getByRole('button', { name: 'Export WEBP', exact: true }).click(); await expect(page.locator('.notice')).toContainText('cannot encode WEBP'); expect(downloads).toEqual([]);
});

test('group jumping reaches privacy tools at tablet width and Bates bounds resolve on commit', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 720 }); await openAdvanced(page); await tools(page);
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await page.getByLabel('Jump to tool group', { exact: true }).selectOption('privacy');
  const bounds = await page.getByLabel('Redact text', { exact: true }).boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(900);
  await page.getByLabel('Jump to tool group', { exact: true }).selectOption('marks');
  const bates = page.getByLabel('Bates start', { exact: true }); await bates.fill('-3'); await bates.press('Enter'); await expect(bates).toHaveValue('0');
  await bates.fill('12.8'); await bates.press('Enter'); await expect(bates).toHaveValue('12'); await bates.fill(''); await bates.press('Tab'); await expect(bates).toHaveValue('');
});
