import { expect, test } from '@playwright/test';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { downloadPdf, openAdvanced } from './advanced-helpers';

test('Review inserts within crop bounds and leaves text-selection mode', async ({ page }) => {
  const pdf = await PDFDocument.create(); pdf.addPage([650, 900]).setCropBox(120, 200, 400, 600);
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'crop.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Select text', exact: true }).click(); await page.getByRole('button', { name: 'Review', exact: true }).click();
  for (const name of ['Highlight', 'Add comment', 'Approved stamp', 'Measure']) await page.getByRole('button', { name, exact: true }).click();
  const result = await page.evaluate(async () => ({ objects: (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects, mode: (await import('/src/store/useTextSelectionStore.ts')).useTextSelectionStore.getState().mode }));
  for (const object of result.objects) if ('x' in object) { expect(object.x).toBeGreaterThanOrEqual(120); expect(object.y).toBeGreaterThanOrEqual(200); }
  expect(result.mode).toBe('edit');
});

test('exported highlight color and appearance retain the chosen color', async ({ page }) => {
  await openAdvanced(page); await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().addObject({ id: 'color', type: 'highlight', page: 1, x: 60, y: 80, width: 140, height: 20, color: '#0088cc', comment: 'Chosen blue', author: 'Editor' }));
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); const pdf = await downloadPdf(await pending);
  const annotation = pdf.getPage(0).node.Annots()!.lookup(0, PDFDict);
  expect((annotation.lookup(PDFName.of('C'), PDFArray)).asArray().map(String)).toEqual(['0', String(136 / 255), '0.8']);
  const stream = annotation.lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N'), PDFRawStream);
  expect(new TextDecoder().decode(decodePDFRawStream(stream).decode())).toContain(`0 ${136 / 255} 0.8 rg`);
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'painted-review.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect.poll(() => page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas').evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext('2d')!.getImageData(105, 840, 1, 1).data))).toEqual([166, 213, 237, 255]);
});

test('Go to changed text closes review and reveals its current display page', async ({ page }) => {
  await openAdvanced(page, 2); await page.evaluate(async () => {
    const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState();
    state.addObject({ id: 'changed', type: 'text', page: 2, x: 40, y: 40, width: 180, text: 'Before', fontSize: 14, color: '#000000' });
    state.setReviewOptions({ trackChanges: true }); state.updateTextObject('changed', 'After');
  });
  await page.getByRole('button', { name: 'Review', exact: true }).click(); await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  await page.getByRole('button', { name: 'Go to changed text', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Tracked changes', exact: true })).not.toBeVisible(); await expect.poll(() => page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().selectedPage)).toBe(2);
});

test('annotation imports reject pages absent from the source document atomically', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByLabel('Import PDFForge XFDF').setInputFiles({ name: 'invalid.xfdf', mimeType: 'text/xml', buffer: Buffer.from('<xfdf><annots><note page="1" x="40" y="40">Valid</note><note page="99" x="40" y="40">Missing</note></annots></xfdf>') });
  await expect(page.getByRole('alert')).toContainText('page'); await expect(page.getByLabel('Annotation comment')).toHaveCount(0);
});

test('a delayed annotation import cannot modify a subsequently opened document', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.evaluate(() => { const original = File.prototype.text; File.prototype.text = function () { if (!this.name.endsWith('.xfdf')) return original.call(this); return new Promise<string>((resolve) => { (window as unknown as { releaseReviewImport: () => Promise<void> }).releaseReviewImport = async () => { resolve(await original.call(this)); }; }); }; });
  await page.getByLabel('Import PDFForge XFDF').setInputFiles({ name: 'delayed.xfdf', mimeType: 'text/xml', buffer: Buffer.from('<xfdf><annots><note page="1" x="40" y="40">Late note</note></annots></xfdf>') });
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseReviewImport: unknown }).releaseReviewImport)).toBe('function');
  const next = await PDFDocument.create(); next.addPage([300, 400]); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'next.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await next.save()) });
  await expect(page.locator('.document-name')).toHaveText('next.pdf'); await page.evaluate(() => (window as unknown as { releaseReviewImport: () => Promise<void> }).releaseReviewImport());
  await expect(page.getByRole('alert')).toContainText('document'); await expect(page.getByLabel('Annotation comment')).toHaveCount(0);
});
