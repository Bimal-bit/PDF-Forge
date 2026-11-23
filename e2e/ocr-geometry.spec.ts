import { expect, test } from '@playwright/test';
import { PDFDocument, degrees } from 'pdf-lib';

test('searchable OCR keeps crop coordinates, native rotation and the selected display page', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 400;
    const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, 1200, 400);
    context.font = 'bold 54px Arial'; context.fillStyle = 'black'; context.fillText('INVOICE TOTAL 12345', 60, 180);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const pdf = await PDFDocument.create(); pdf.addPage([800, 600]);
  const scan = pdf.addPage([800, 600]); scan.setCropBox(80, 180, 650, 240); scan.setRotation(degrees(90));
  scan.drawImage(await pdf.embedPng(Buffer.from(image, 'base64')), { x: 100, y: 200, width: 600, height: 200 });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'crop-scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await page.getByRole('button', { name: 'Search actions', exact: true }).click();
  await page.getByLabel('Search commands').fill('OCR');
  await page.getByRole('button', { name: 'Scan image text (Offline OCR)', exact: true }).click();
  await page.getByLabel('OCR pages', { exact: true }).selectOption('current');
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Offline OCR', exact: true })).toHaveCount(0, { timeout: 100000 });
  await expect(page.getByLabel('Page number', { exact: true })).toHaveValue('2');
  const geometry = await page.evaluate(async () => {
    const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState();
    const pdf = await (await import('/src/lib/pdf.ts')).openPdf(state.document!);
    try {
      const first = await (await pdf.getPage(1)).getTextContent();
      const second = await pdf.getPage(2);
      const content = await second.getTextContent();
      const invoice = content.items.find((item) => 'str' in item && item.str.includes('INVOICE'));
      return { firstText: first.items.filter((item) => 'str' in item).map((item) => item.str).join(''), rotation: second.rotate, crop: second.view, position: invoice && 'transform' in invoice ? invoice.transform.slice(4) : undefined };
    } finally { await pdf.loadingTask.destroy(); }
  });
  expect(geometry).toMatchObject({ firstText: '', rotation: 90, crop: [80, 180, 730, 420] });
  expect(geometry.position![0]).toBeGreaterThan(125); expect(geometry.position![0]).toBeLessThan(145);
  expect(geometry.position![1]).toBeGreaterThan(300); expect(geometry.position![1]).toBeLessThan(335);
});

test('empty recognition leaves the source intact', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/'); await page.getByRole('button', { name: 'Start a blank PDF', exact: false }).click();
  await page.getByRole('button', { name: 'Tools', exact: true }).click(); await page.getByRole('button', { name: 'Offline OCR', exact: true }).click();
  await page.getByLabel('OCR result', { exact: true }).selectOption('editable');
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No text was detected', { timeout: 100000 });
  await expect(page.getByRole('button', { name: 'Recognize document', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Close Offline OCR', exact: true }).click();
  await expect(page.locator('.document-name')).toHaveText('Untitled.pdf');
  await expect(page.locator('.text-object')).toHaveCount(0);
});
