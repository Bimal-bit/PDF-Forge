import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { openAdvanced } from './advanced-helpers';

test('standalone one-column frames detect overflow and block a clipped PDF export', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: 'Text flow & columns', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Text flow & columns', exact: true });
  await dialog.getByRole('button', { name: 'Add text box', exact: true }).click();
  await dialog.getByLabel('Text box content').fill('A long story needs enough room in its frame. '.repeat(10));
  await dialog.getByLabel('Text frame width', { exact: true }).fill('80'); await dialog.getByLabel('Text frame height', { exact: true }).fill('25');
  await expect(dialog.getByRole('status')).toContainText('characters overflow');
  await page.keyboard.press('Escape'); await page.getByLabel('Export PDF', { exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Text overflows a story');
});

test('Layout frames use crop bounds and leave text selection when inserted', async ({ page }) => {
  const pdf = await PDFDocument.create(); pdf.addPage([650, 900]).setCropBox(120, 200, 400, 600);
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'crop.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Select text', exact: true }).click();
  await page.getByRole('button', { name: 'Layout', exact: true }).click(); await page.getByRole('button', { name: 'Text flow & columns', exact: true }).click();
  await page.getByRole('button', { name: 'Add text box', exact: true }).click();
  const result = await page.evaluate(async () => {
    const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState();
    const mode = (await import('/src/store/useTextSelectionStore.ts')).useTextSelectionStore.getState().mode;
    return { object: state.objects[0], mode };
  });
  expect(result.object.x).toBeGreaterThanOrEqual(120); expect(result.object.y).toBeGreaterThanOrEqual(200); expect(result.mode).toBe('edit');
});

test('frame dimensions accept ordinary keyboard entry of small values', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Layout', exact: true }).click(); await page.getByRole('button', { name: 'Text flow & columns', exact: true }).click();
  await page.getByRole('button', { name: 'Add text box', exact: true }).click();
  const width = page.getByLabel('Text frame width', { exact: true }); await width.fill(''); await width.pressSequentially('25'); await width.press('Tab'); await expect(width).toHaveValue('25');
});

test('shape dimensions and equation sizes accept normal keyboard entry', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Layout', exact: true }).click(); await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Shapes & connectors', exact: true }).click();
  await page.getByRole('button', { name: 'Add flowchart shape', exact: true }).click();
  const width = page.getByLabel('Shape width', { exact: true }); await width.fill(''); await width.pressSequentially('25'); await width.press('Tab'); await expect(width).toHaveValue('25');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Equation editor', exact: true }).click();
  const size = page.getByLabel('Equation fontSize', { exact: true }); await size.fill(''); await size.pressSequentially('14'); await size.press('Tab'); await expect(size).toHaveValue('14');
});

test('closing Image tools cancels a delayed apply and permits a fresh operation', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 50; return canvas.toDataURL().split(',')[1]; });
  await page.getByLabel('Add image', { exact: true }).setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await expect(page.locator('.image-object')).toBeVisible();
  await page.getByRole('button', { name: 'Layout', exact: true }).click(); await page.getByRole('button', { name: 'Image tools', exact: true }).click();
  await page.evaluate(() => {
    const decode = window.createImageBitmap.bind(window);
    const pending = window as unknown as { imageDecodeCount: number; finishImage: () => Promise<void> };
    pending.imageDecodeCount = 0;
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => new Promise<ImageBitmap>((resolve, reject) => {
      pending.imageDecodeCount += 1;
      pending.finishImage = async () => { await Reflect.apply(decode, window, args).then(resolve, reject); };
    })) as typeof createImageBitmap;
  });
  await page.getByLabel('Image rotation').selectOption('90'); await page.getByRole('button', { name: 'Apply image edits', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Processing image'); await page.getByLabel('Close Image tools').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { imageDecodeCount: number }).imageDecodeCount)).toBe(1);
  await page.evaluate(() => (window as unknown as { finishImage: () => Promise<void> }).finishImage());
  await expect.poll(() => page.evaluate(async () => {
    const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState(); const image = state.objects.find((object) => object.type === 'image')!; return image.width;
  })).toBe(180);
  await page.getByRole('button', { name: 'Image tools', exact: true }).click(); await expect(page.getByLabel('Image rotation')).toHaveValue('0');
  const brightness = page.getByLabel('Image brightness', { exact: true }); await brightness.fill(''); await brightness.pressSequentially('-10'); await brightness.press('Tab'); await expect(brightness).toHaveValue('-10');
  await page.getByLabel('Image rotation').selectOption('270'); await page.getByRole('button', { name: 'Apply image edits', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Processing image');
  await expect.poll(() => page.evaluate(() => (window as unknown as { imageDecodeCount: number }).imageDecodeCount)).toBe(2);
  await page.evaluate(() => (window as unknown as { finishImage: () => Promise<void> }).finishImage());
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Image edits applied');
  await page.getByLabel('Close Image tools').click(); await expect(page.locator('.image-object')).toHaveCSS('width', '90px');
});
