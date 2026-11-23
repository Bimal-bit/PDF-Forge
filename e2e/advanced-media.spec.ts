import { expect, test } from '@playwright/test';
import { downloadPdf, openAdvanced, pageStreams } from './advanced-helpers';

test('image crop, rotation, backdrop removal, and tone edits survive undo, export, and recovery', async ({ page }) => {
  await openAdvanced(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff'; context.fillRect(0, 0, 100, 80);
    context.fillStyle = '#000'; context.fillRect(20, 20, 60, 40);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByLabel('Add image', { exact: true }).setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const original = await page.locator('.image-object').getAttribute('src');
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: 'Image tools', exact: true }).click();
  const tools = page.getByRole('dialog', { name: 'Image tools' });
  await tools.getByLabel('Crop left', { exact: true }).fill('10');
  await tools.getByLabel('Crop width', { exact: true }).fill('80');
  await tools.getByLabel('Image rotation').selectOption('90');
  await tools.getByLabel('Image brightness').fill('10');
  await tools.getByLabel('Image contrast').fill('10');
  await tools.getByLabel('Remove background', { exact: true }).check();
  await tools.getByLabel('Background tolerance').fill('0');
  await tools.getByRole('button', { name: 'Preview image edits', exact: true }).click();
  await expect(tools.getByAltText('Edited image preview')).toBeVisible();
  await tools.getByRole('button', { name: 'Apply image edits', exact: true }).click();
  await expect(tools.getByRole('status')).toContainText('Image edits applied');
  await tools.getByLabel('Close Image tools').click();
  await expect(page.locator('.image-object')).toHaveCSS('width', '144px');
  await expect(page.locator('.image-object')).toHaveCSS('height', '144px');
  const pixels = await page.locator('.image-object').evaluate(async (element: HTMLImageElement) => {
    const bitmap = await createImageBitmap(await fetch(element.src).then((response) => response.blob()));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close();
    return { corner: Array.from(context.getImageData(0, 0, 1, 1).data), center: Array.from(context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data) };
  });
  expect(pixels.corner[3]).toBe(0); expect(pixels.center[3]).toBe(255); expect(pixels.center[0]).toBeGreaterThan(0);
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.locator('.image-object')).toHaveAttribute('src', original!);
  await page.getByLabel('Redo', { exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await downloadPdf(await pending);
  expect(pdf.context.enumerateIndirectObjects().map(([, value]) => value.toString()).join('')).toContain('/SMask');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await expect(page.locator('.image-object')).toHaveCSS('height', '144px');
});

for (const mask of ['ellipse', 'rounded']) {
  test(`${mask} image masks preserve their transparent corners`, async ({ page }) => {
    await openAdvanced(page);
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80;
      const context = canvas.getContext('2d')!; context.fillStyle = '#f00'; context.fillRect(0, 0, 80, 80);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    await page.getByLabel('Add image', { exact: true }).setInputFiles({ name: 'mask.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.getByRole('button', { name: 'Layout', exact: true }).click();
    await page.getByRole('button', { name: 'Image tools', exact: true }).click();
    const tools = page.getByRole('dialog', { name: 'Image tools' });
    await tools.getByLabel('Image mask').selectOption(mask);
    await tools.getByRole('button', { name: 'Apply image edits', exact: true }).click();
    await expect(tools.getByRole('status')).toContainText('Image edits applied');
    const alpha = await tools.getByAltText('Current inserted image').evaluate(async (element: HTMLImageElement) => {
      await element.decode(); const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80;
      const context = canvas.getContext('2d')!; context.drawImage(element, 0, 0);
      return [context.getImageData(0, 0, 1, 1).data[3], context.getImageData(40, 40, 1, 1).data[3]];
    });
    expect(alpha).toEqual([0, 255]);
  });
}

test('LaTeX equations preview, update, undo, and export as vector math', async ({ page }) => {
  await openAdvanced(page);
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Equation editor', exact: true }).click();
  const tools = page.getByRole('dialog', { name: 'Equation editor' });
  await tools.getByLabel('Equation LaTeX').fill('\\unknown{x}');
  await expect(tools.getByRole('alert')).toContainText('Unsupported');
  await expect(tools.getByRole('button', { name: 'Insert equation', exact: true })).toBeDisabled();
  const latex = '\\frac{\\alpha_1+x^2}{\\sqrt{y}}';
  await tools.getByLabel('Equation LaTeX').fill(latex);
  await expect(tools.getByRole('img', { name: 'Equation preview' })).toBeVisible();
  await tools.getByRole('button', { name: 'Insert equation', exact: true }).click();
  await tools.getByLabel('Close Equation editor').click();
  await expect(page.locator('.equation-object')).toHaveAttribute('aria-label', latex);
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Equation editor', exact: true }).click();
  await tools.getByLabel('Equation LaTeX').fill('x^3 + \\pi');
  await tools.getByRole('button', { name: 'Update selected equation', exact: true }).click();
  await tools.getByLabel('Close Equation editor').click();
  await expect(page.locator('.equation-object')).toHaveCount(1);
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.locator('.equation-object')).toHaveAttribute('aria-label', latex);
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await downloadPdf(await pending);
  expect(pageStreams(pdf)).toContain(' l');
  expect(pdf.context.enumerateIndirectObjects().map(([, value]) => value.toString()).join('')).not.toContain('/Subtype /Image');
});

test('tracked source edits keep authors, support review undo, and recover pending changes', async ({ page }) => {
  await openAdvanced(page, 1, 'Original paragraph');
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  const tools = page.getByRole('dialog', { name: 'Tracked changes' });
  await tools.getByLabel('Track text changes').check();
  await tools.getByLabel('Change author').fill('Ava');
  await tools.getByLabel('Close Tracked changes').click();
  await page.locator('.text-layer span').filter({ hasText: 'Original paragraph' }).dblclick();
  await page.getByLabel('Edit PDF text').fill('First revision');
  await page.getByLabel('Find text in document').click();
  await expect(page.locator('.tracked-text-object')).toHaveCount(1);
  await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  await expect(tools.getByRole('list', { name: 'Text changes', exact: true })).toContainText('Original paragraph');
  await tools.getByLabel('Change author').fill('Ben');
  await tools.getByLabel('Close Tracked changes').click();
  await page.getByLabel('Overlay text').fill('Reviewed by both');
  await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  await expect(tools.getByRole('list', { name: 'Text changes', exact: true }).locator('li')).toHaveCount(1);
  await expect(tools.getByRole('list', { name: 'Text changes', exact: true })).toContainText('Ava, Ben');
  await tools.getByRole('button', { name: 'Reject change', exact: true }).click();
  await tools.getByLabel('Close Tracked changes').click();
  await expect(page.getByLabel('Overlay text')).toHaveCount(0);
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Reviewed by both');
  await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  await tools.getByRole('button', { name: 'Accept change', exact: true }).click();
  await tools.getByLabel('Close Tracked changes').click();
  await page.getByLabel('Overlay text').fill('Another revision');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  await expect(tools.getByLabel('Track text changes')).toBeChecked();
  await expect(tools.getByRole('list', { name: 'Text changes', exact: true })).toContainText('Another revision');
  await tools.getByLabel('Change filter').selectOption('all');
  await expect(tools.getByRole('list', { name: 'Text changes', exact: true }).locator('li')).toHaveCount(2);
  await tools.getByRole('button', { name: 'Reject change', exact: true }).click();
  await tools.getByLabel('Close Tracked changes').click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Reviewed by both');
});
