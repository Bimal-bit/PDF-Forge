import { expect, test, type Page } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

async function openMixed(page: Page, small = false) {
  await page.goto('/');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 240;
    const context = canvas.getContext('2d')!; context.fillStyle = '#fff2d9'; context.fillRect(0, 0, 1200, 240);
    context.font = 'bold 42px Arial'; context.fillStyle = '#b82035'; context.fillText('EMBEDDED IMAGE TOTAL 12345', 24, 130);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const pdf = await PDFDocument.create(), sheet = pdf.addPage([500, 700]);
  sheet.drawText('Native PDF heading', { x: 50, y: 620, size: 22, color: rgb(0, 0, .4) });
  const width = small ? 120 : 400;
  sheet.drawImage(await pdf.embedPng(Buffer.from(png, 'base64')), { x: 50, y: 350, width, height: width / 5 });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'embedded.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByRole('article', { name: 'Page 1', exact: true })).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: small ? 'Edit text in images' : 'Offline OCR', exact: true }).click();
  await page.getByLabel('OCR result', { exact: true }).selectOption('editable');
}

async function imagePixels(page: Page) {
  if (await page.getByRole('alert').count()) await page.getByRole('alert').click();
  const bounds = (await page.getByRole('article', { name: 'Page 1', exact: true }).boundingBox())!;
  return page.screenshot({ clip: { x: bounds.x + 48, y: bounds.y + 268, width: 404, height: 84 } });
}

test('recognizes tiny image text inside a mixed PDF without duplicating native text', async ({ page }) => {
  test.setTimeout(120000);
  await openMixed(page, true);
  await expect(page.getByLabel('OCR result', { exact: true })).toHaveValue('editable');
  await expect(page.getByLabel('OCR target', { exact: true })).toHaveValue('images');
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review detected text', exact: true })).toBeVisible({ timeout: 100000 });
  const text = await page.locator('.ocr-lines textarea').evaluateAll((nodes) => nodes.map((node) => (node as HTMLTextAreaElement).value).join('\n'));
  expect(text).toContain('EMBEDDED IMAGE TOTAL 12345');
  expect(text).not.toContain('Native PDF heading');
});

test('unchanged detected image text keeps its original pixels and editing preserves the line style', async ({ page }) => {
  test.setTimeout(120000);
  await openMixed(page);
  await page.getByRole('button', { name: 'Close Offline OCR', exact: true }).click();
  await page.getByRole('alert').click();
  await page.mouse.move(0, 0);
  const paper = page.getByRole('article', { name: 'Page 1', exact: true });
  const before = await imagePixels(page);
  await page.getByRole('button', { name: 'Offline OCR', exact: true }).click();
  await page.getByLabel('OCR result', { exact: true }).selectOption('editable');
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply editable text', exact: true })).toBeVisible({ timeout: 100000 });
  await page.getByRole('button', { name: 'Apply editable text', exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(1);
  await expect(paper).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('alert').click();
  await page.mouse.move(0, 0);
  const original = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects.find((object) => object.type === 'text'));
  const preserved = await page.evaluate(async () => { const s = (await import('/src/store/useAppStore.ts')).useAppStore.getState(); const o = s.objects.find((object) => object.type === 'text')!; return { preserved: (await import('/src/lib/ocrAppearance.ts')).preservesOcrPixels(o), style: o }; });
  expect(preserved.preserved, JSON.stringify(preserved.style)).toBe(true);
  expect((await imagePixels(page)).equals(before)).toBe(true);
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload(); await expect(page.locator('.text-object')).toHaveCount(1);
  await expect(paper).toHaveAttribute('data-rendered', 'true');
  expect((await imagePixels(page)).equals(before)).toBe(true);
  expect(original).toMatchObject({ fontFamily: 'Helvetica', bold: true, color: '#b82035', cover: { color: '#fff2d9' } });
  const download = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const exported = await readFile((await (await download).path())!);
  const exportedText = await page.evaluate(async (data) => { const source = (await import('/src/store/useAppStore.ts')).useAppStore.getState().document!; const pdf = await (await import('/src/lib/pdf.ts')).openPdf({ ...source, id: 'roundtrip', data: new Uint8Array(data).buffer }); try { return (await (await pdf.getPage(1)).getTextContent()).items.filter((item) => 'str' in item).map((item) => item.str).join(' '); } finally { await pdf.loadingTask.destroy(); } }, Array.from(exported));
  expect(exportedText).toContain('EMBEDDED IMAGE TOTAL 12345');
  await page.getByLabel('Overlay text', { exact: true }).fill('EMBEDDED IMAGE TOTAL 54321');
  const changed = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects.find((object) => object.type === 'text'));
  expect(changed).toMatchObject({ x: original!.x, y: original!.y, fontSize: original!.type === 'text' ? original!.fontSize : 0 });
  await page.getByLabel('Undo', { exact: true }).click(); await page.mouse.move(0, 0);
  expect((await imagePixels(page)).equals(before)).toBe(true);
});

test('whole-page fallback and layout controls can recognize an unusual page without raster paints', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/'); const pdf = await PDFDocument.create(); pdf.addPage([500, 200]).drawText('FALLBACK TOTAL 98765', { x: 30, y: 100, size: 24 });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'fallback.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Tools', exact: true }).click(); await page.getByRole('button', { name: 'Edit text in images', exact: true }).click();
  await page.getByText('Recognition options', { exact: true }).click();
  await page.getByLabel('OCR target', { exact: true }).selectOption('pages'); await page.getByLabel('OCR layout', { exact: true }).selectOption('line');
  await page.getByLabel('Improve faint text', { exact: true }).uncheck(); await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await expect(page.getByLabel('OCR line 1', { exact: true })).toHaveValue('FALLBACK TOTAL 98765', { timeout: 100000 });
});

test('contrast enhancement recognizes faint lettering on a dark embedded image', async ({ page }) => {
  test.setTimeout(120000); await page.goto('/');
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 240; const c = canvas.getContext('2d')!; c.fillStyle = '#20252c'; c.fillRect(0, 0, 1200, 240); c.font = '56px Arial'; c.fillStyle = '#59616c'; c.fillText('DARK IMAGE TOTAL 45678', 30, 140); return canvas.toDataURL('image/png').split(',')[1]; });
  const pdf = await PDFDocument.create(); pdf.addPage([500, 700]).drawImage(await pdf.embedPng(Buffer.from(png, 'base64')), { x: 50, y: 350, width: 350, height: 70 });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'dark-scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Tools', exact: true }).click(); await page.getByRole('button', { name: 'Edit text in images', exact: true }).click();
  await expect(page.getByLabel('Improve faint text', { exact: true })).toBeChecked(); await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await expect(page.getByLabel('OCR line 1', { exact: true })).toHaveValue('DARK IMAGE TOTAL 45678', { timeout: 100000 });
  await page.getByRole('button', { name: 'Apply editable text', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Offline OCR', exact: true })).toHaveCount(0);
  const object = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects.find((entry) => entry.type === 'text'));
  expect(object).toMatchObject({ color: '#59616c', cover: { color: '#20252c' } });
});
