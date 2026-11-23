import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { openAdvanced } from './advanced-helpers';

test('Home inserts visible text inside an offset crop box', async ({ page }) => {
  const pdf = await PDFDocument.create(); const sheet = pdf.addPage([650, 900]); sheet.setCropBox(120, 200, 400, 600);
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'cropped.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  const text = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects.find((object) => object.type === 'text')!);
  expect(text.x).toBeGreaterThanOrEqual(120); expect(text.y).toBeGreaterThanOrEqual(200);
  const box = (await page.locator('.text-object').boundingBox())!, bounds = (await page.getByRole('article', { name: 'Page 1', exact: true }).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(bounds.x); expect(box.y).toBeGreaterThanOrEqual(bounds.y);
  expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  for (const name of ['Replace text', 'Clean up text']) {
    const layout = await page.getByRole('button', { name, exact: true }).evaluate((button) => {
      const text = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())!;
      const range = document.createRange(); range.selectNodeContents(text); const label = range.getBoundingClientRect(), bounds = button.getBoundingClientRect();
      return { labelTop: label.top, labelBottom: label.bottom, top: bounds.top, bottom: bounds.bottom };
    });
    expect(layout.labelTop).toBeGreaterThanOrEqual(layout.top); expect(layout.labelBottom).toBeLessThanOrEqual(layout.bottom);
  }
});

for (const kind of ['shape', 'equation'] as const) {
  test(`advanced ${kind} insertion leaves document text selection`, async ({ page }) => {
    await openAdvanced(page, 1, 'Text for selection');
    await page.getByRole('button', { name: 'Select all text', exact: true }).click();
    await expect(page.getByLabel('Home selection details')).toContainText('1 text run');
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    const title = kind === 'shape' ? 'Shapes & connectors' : 'Equation editor';
    await page.getByRole('button', { name: title, exact: true }).click();
    await page.getByRole('button', { name: kind === 'shape' ? 'Add flowchart shape' : 'Insert equation', exact: true }).click();
    await page.getByLabel(`Close ${title}`, { exact: true }).click();
    expect(await page.evaluate(async () => (await import('/src/store/useTextSelectionStore.ts')).useTextSelectionStore.getState().mode)).toBe('edit');
  });
}

for (const kind of ['table', 'link'] as const) {
  test(`closing a ${kind} dialog cancels a delayed save`, async ({ page }) => {
    await openAdvanced(page); await page.getByRole('button', { name: 'Insert', exact: true }).click();
    let release!: () => void; const pending = new Promise<void>((resolve) => { release = resolve; });
    let started = false;
    await page.route('**/fonts/NotoSans-Regular.ttf', async (route) => { started = true; await pending; await route.continue(); });
    await page.getByRole('button', { name: `Add ${kind}`, exact: true }).click();
    if (kind === 'link') await page.getByLabel('Link destination', { exact: true }).fill('https://example.com');
    await page.getByRole('button', { name: `Insert ${kind}`, exact: true }).click();
    await expect.poll(() => started).toBe(true);
    await page.getByLabel(`Close Insert ${kind}`, { exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible(); release();
    await expect.poll(() => page.evaluate(async () => { const { prepareTableMetrics } = await import('/src/lib/tableLayout.ts'); await prepareTableMetrics(); return true; })).toBe(true);
    expect(await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects.length)).toBe(0);
  });
}
