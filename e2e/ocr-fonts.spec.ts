import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { pageStreams } from './advanced-helpers';

async function recognizeFont(page: Page, family: string, id: string, bold = true, italic = false) {
  await page.goto('/');
  const png = await page.evaluate(async ({ id, bold, italic }) => {
    const font = new FontFace('SourcePhoto', `url(/fonts/catalog/${id}/${bold ? 700 : 400}-${italic ? 'italic' : 'normal'}.ttf)`, { weight: bold ? '700' : '400', style: italic ? 'italic' : 'normal' });
    await font.load(); document.fonts.add(font);
    const canvas = document.createElement('canvas'); canvas.width = 1500; canvas.height = 240;
    const c = canvas.getContext('2d')!; c.fillStyle = '#fff2d9'; c.fillRect(0, 0, 1500, 240);
    c.font = `${italic ? 'italic ' : ''}${bold ? '700' : '400'} 52px SourcePhoto`; c.fillStyle = '#303030'; c.fillText('Modern typography invoice 12345', 30, 140);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { id, bold, italic });
  const pdf = await PDFDocument.create(); pdf.addPage([600, 700]).drawImage(await pdf.embedPng(Buffer.from(png, 'base64')), { x: 50, y: 350, width: 500, height: 80 });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: `${id}-scan.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Tools', exact: true }).click(); await page.getByRole('button', { name: 'Edit text in images', exact: true }).click();
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await expect(page.getByLabel('OCR line 1', { exact: true })).toHaveValue(/Modern typography invoice 12345/, { timeout: 100000 });
  await expect(page.locator('.ocr-lines')).toContainText(family);
}

for (const [family, id, bold, italic] of [['Poppins', 'poppins', true, false], ['Merriweather', 'merriweather', true, true], ['Roboto Mono', 'roboto-mono', false, false]] as const) test(`image OCR matches ${family} and uses it in editor and PDF export`, async ({ page }) => {
  test.setTimeout(120000);
  await recognizeFont(page, family, id, bold, italic);
  await page.getByLabel('OCR line 1', { exact: true }).fill('Modern typography invoice 54321');
  await page.getByRole('button', { name: 'Apply editable text', exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCSS('font-family', `PDFForge-${id}`);
  await expect(page.locator('.text-object')).toHaveCSS('font-style', italic ? 'italic' : 'normal');
  await expect(page.locator('.text-object')).toHaveCSS('font-weight', bold ? '700' : '400');
  const download = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await PDFDocument.load(await readFile((await (await download).path())!));
  expect(pageStreams(result)).toMatch(new RegExp(`${family.replaceAll(' ', '')}[^ /]*-\\d+ [\\d.]+ Tf`));
});

test('font comparison offers real previews, bundled faces and original-font import before applying', async ({ page }) => {
  test.setTimeout(120000); await recognizeFont(page, 'Poppins', 'poppins');
  await page.getByRole('button', { name: 'Compare / change font', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Original image text on line 1', exact: true })).toBeVisible();
  await expect(page.getByLabel('Replacement font preview for line 1', { exact: true })).toBeVisible();
  await page.getByLabel('OCR font family 1', { exact: true }).selectOption('Lora');
  await expect(page.getByLabel('OCR font family 1', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('OCR font family 1', { exact: true })).toHaveValue('Lora');
  await page.getByLabel('Import OCR font 1', { exact: true }).setInputFiles('public/fonts/catalog/roboto-mono/400-normal.ttf');
  await expect(page.getByLabel('OCR font family 1', { exact: true })).toHaveValue('Roboto Mono');
  await page.getByLabel('OCR font size 1', { exact: true }).fill('18.25');
  await page.getByLabel('OCR text width 1', { exact: true }).fill('97.5');
  await page.getByLabel('OCR line 1', { exact: true }).fill('Imported font invoice 54321');
  await page.getByRole('button', { name: 'Apply editable text', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Offline OCR', exact: true })).toHaveCount(0);
  const object = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects.find((entry) => entry.type === 'text'));
  expect(object).toMatchObject({ fontFamily: 'Roboto Mono', fontSize: 18.25, fontFace: { family: 'Roboto Mono', bold: false, italic: false }, sourceLayout: { horizontalScale: .975 } });
  const download = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await PDFDocument.load(await readFile((await (await download).path())!));
  expect(pageStreams(result)).toMatch(/RobotoMono[^ /]*-\d+ 18.25 Tf/);
});

test('Home rematches an existing OCR edit from the source image without replacing edited wording', async ({ page }) => {
  test.setTimeout(120000); await recognizeFont(page, 'Poppins', 'poppins');
  await page.getByLabel('OCR line 1', { exact: true }).fill('Keep my changed wording 54321'); await page.getByRole('button', { name: 'Apply editable text', exact: true }).click();
  await page.getByLabel('Font family', { exact: true }).selectOption('Helvetica');
  await page.getByRole('button', { name: 'Match image font', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Match image font', exact: true });
  await expect(dialog.getByLabel('Detected image font', { exact: true })).toContainText('Poppins', { timeout: 100000 });
  await dialog.getByRole('button', { name: 'Apply matched font', exact: true }).click();
  await expect(page.locator('.text-object')).toContainText('Keep my changed wording 54321');
  await expect(page.locator('.text-object')).toHaveCSS('font-family', 'PDFForge-poppins');
  await page.getByLabel('Undo', { exact: true }).click(); await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('Helvetica');
  await page.getByLabel('Redo', { exact: true }).click(); await expect(page.locator('.text-object')).toHaveCSS('font-family', 'PDFForge-poppins');
});
