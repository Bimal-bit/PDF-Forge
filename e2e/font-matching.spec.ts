import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { downloadPdf, pageStreams } from './advanced-helpers';

async function open(page: Page, pdf: PDFDocument) {
  await page.goto('/');
  await page
    .getByLabel('Open PDF', { exact: true })
    .setInputFiles({
      name: 'fonts.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await pdf.save()),
    });
}

test('100 real families apply their regular, bold, italic, and bold-italic faces to preview and PDF export', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const source = await PDFDocument.create();
  source.addPage([500, 650]);
  await open(page, source);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Real font sample');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const picker = page.getByLabel('Font family', { exact: true });
  await expect(picker.locator('optgroup[label="100 bundled font families"] option')).toHaveCount(
    100,
  );
  for (const family of ['Poppins', 'Lora', 'Roboto Mono']) {
    await picker.selectOption(family);
    await expect(page.locator('.text-object')).toHaveCSS(
      'font-family',
      `PDFForge-${family.toLowerCase().replaceAll(' ', '-')}`,
    );
    await page.getByLabel('bold', { exact: true }).click();
    await page.getByLabel('italic', { exact: true }).click();
    await expect(page.locator('.text-object')).toHaveCSS('font-weight', '700');
    await expect(page.locator('.text-object')).toHaveCSS('font-style', 'italic');
    const pending = page.waitForEvent('download');
    await page.getByLabel('Export PDF', { exact: true }).click();
    const streams = pageStreams(await downloadPdf(await pending));
    expect(streams).toMatch(new RegExp(`/${family.replaceAll(' ', '')}[^ /]*-\\d+ 14 Tf`));
    await page.getByLabel('bold', { exact: true }).click();
    await page.getByLabel('italic', { exact: true }).click();
  }
});

test('clicking source text reuses the embedded glyph outlines, size, and emphasis through undo, recovery, and export', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const bytes = await readFile('public/fonts/catalog/lora/700-italic.ttf');
  const expectedGlyph = fontkit.create(bytes).glyphForCodePoint(75).path.toSVG();
  const source = await PDFDocument.create();
  source.registerFontkit(fontkit);
  const face = await source.embedFont(bytes, {
    subset: true,
    customName: 'OriginalBrand-BoldItalic',
  });
  source
    .addPage([500, 650])
    .drawText('KEEP ORIGINAL FACE', { x: 40, y: 550, size: 17.5, font: face });
  await open(page, source);
  const editor = page.getByLabel('Edit PDF text', { exact: true });
  await page.locator('.text-layer span').filter({ hasText: 'KEEP ORIGINAL FACE' }).click();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveCSS('font-size', '17.5px');
  await expect(editor).toHaveCSS('font-weight', '700');
  await expect(editor).toHaveCSS('font-style', 'italic');
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('OriginalBrand');
  const actualGlyph = await page.evaluate(async () => {
    const fontsPath = '/src/lib/textFonts.ts';
    const storePath = '/src/store/useTextEditStore.ts';
    const { prepareTextFont } = await import(/* @vite-ignore */ fontsPath);
    const { useTextEditStore } = await import(/* @vite-ignore */ storePath);
    const loaded = await prepareTextFont(useTextEditStore.getState().draft);
    return loaded.font.glyphForCodePoint(75).path.toSVG();
  });
  expect(actualGlyph).toBe(expectedGlyph);
  await editor.fill('KEEP');
  await page.getByLabel('Find text in document').click();
  await page.locator('.text-object').click();
  await editor.fill('FACE');
  await page.getByLabel('Find text in document').click();
  await expect(page.getByLabel('Overlay text')).toHaveCount(1);
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('KEEP');
  await page.getByLabel('Redo', { exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('FACE');
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const exported = await downloadPdf(await pending);
  expect(pageStreams(exported)).toMatch(/PDFForgeOriginal[^ /]* 17.5 Tf/);
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await page.locator('.text-object').click();
  await expect(editor).toHaveText('FACE');
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('OriginalBrand');
  await expect(editor).toHaveCSS('font-style', 'italic');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Overlay text')).toHaveValue('FACE');
});

test('a partial embedded font reports missing characters and accepts the full matching local font', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const bytes = await readFile('public/fonts/catalog/lora/400-normal.ttf');
  const source = await PDFDocument.create();
  source.registerFontkit(fontkit);
  const face = await source.embedFont(bytes, { subset: true, customName: 'BrandSubset-Regular' });
  source.addPage([500, 650]).drawText('ABC', { x: 40, y: 550, size: 18, font: face });
  await open(page, source);
  await page.locator('.text-layer span').filter({ hasText: 'ABC' }).click();
  await page.getByLabel('Edit PDF text').fill('Different letters');
  await expect(page.locator('.font-edit-status')).toContainText('Missing glyphs');
  await page.getByLabel('Find text in document').click();
  await page.getByLabel('Export PDF', { exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Import the full matching font');
  await page
    .getByLabel('Import matching font')
    .setInputFiles({ name: 'Lora-Regular.ttf', mimeType: 'font/ttf', buffer: bytes });
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('Lora');
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  expect((await downloadPdf(await pending)).getPageCount()).toBe(1);
});

test('click editing preserves standard font size at zoom and Escape cancels without creating an object', async ({
  page,
}) => {
  const source = await PDFDocument.create();
  source
    .addPage([400, 500])
    .drawText('Standard bold italic', {
      x: 40,
      y: 400,
      size: 21.5,
      font: await source.embedFont(StandardFonts.TimesRomanBoldItalic),
    });
  await open(page, source);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const run = page.locator('.text-layer span').filter({ hasText: 'Standard bold italic' });
  await run.click();
  await expect(page.getByLabel('Edit PDF text')).toHaveCSS('font-size', '23.65px');
  await expect(page.getByLabel('Edit PDF text')).toHaveCSS('font-weight', '700');
  await expect(page.getByLabel('Edit PDF text')).toHaveCSS('font-style', 'italic');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Overlay text')).toHaveCount(0);
  await run.focus();
  await run.press('Enter');
  await expect(page.getByLabel('Edit PDF text')).toBeFocused();
});

test('the matching bundled full font supplies new characters missing from a source subset', async ({
  page,
}) => {
  const bytes = await readFile('public/fonts/catalog/lora/400-normal.ttf');
  const source = await PDFDocument.create();
  source.registerFontkit(fontkit);
  const face = await source.embedFont(bytes, { subset: true });
  source.addPage([500, 650]).drawText('ABC', { x: 40, y: 550, size: 18, font: face });
  await open(page, source);
  await page.locator('.text-layer span').filter({ hasText: 'ABC' }).click();
  const editor = page.getByLabel('Edit PDF text');
  await editor.fill('Different letters');
  await expect(editor).toHaveCSS('font-family', 'PDFForge-lora');
  await expect(page.locator('.font-edit-status')).toHaveCount(0);
  await page.getByLabel('Find text in document').click();
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  expect((await downloadPdf(await pending)).getPageCount()).toBe(1);
});
