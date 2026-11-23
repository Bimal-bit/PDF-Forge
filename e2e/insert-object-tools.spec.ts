import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openAdvanced, downloadPdf, pageStreams } from './advanced-helpers';

test('CSV tables import quoted values, download drafts, reject invalid grids, and remain editable/exportable', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Insert table', exact: true });
  const csv = 'Name,Status\r\n"Alpha, beta",Ready\r\n"Multi\nline",Ω';
  await dialog.getByLabel('Import table CSV', { exact: true }).setInputFiles({ name: 'table.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(dialog.getByRole('status')).toContainText('Imported 3 rows and 2 columns');
  await expect(dialog.getByLabel('Cell 2:1', { exact: true })).toHaveValue('Alpha, beta');
  await expect(dialog.getByLabel('Cell 3:1', { exact: true })).toHaveValue('Multi\nline');
  const pendingCsv = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Download table CSV', exact: true }).click();
  const downloaded = (await readFile((await (await pendingCsv).path())!)).toString('utf8'); expect(downloaded).toContain('"Alpha, beta"'); expect(downloaded).toContain('"Ω"');
  await dialog.getByLabel('Import table CSV', { exact: true }).setInputFiles({ name: 'oversize.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b,c,d,e,f,g') });
  await expect(dialog.getByRole('alert')).toContainText('6 columns');
  await expect(dialog.getByLabel('Cell 2:1', { exact: true })).toHaveValue('Alpha, beta');
  await dialog.getByRole('button', { name: 'Insert table', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Alpha, beta', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit table', exact: true }).click(); await expect(page.getByLabel('Cell 3:2', { exact: true })).toHaveValue('Ω');
  await page.keyboard.press('Escape');
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); expect(pageStreams(await downloadPdf(await pending))).toContain(' Tf');
});

test('Object tools move, resize, duplicate, and remove shapes with atomic history', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add shape', exact: true }).click();
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click();
  const tools = page.getByRole('dialog', { name: 'Object tools', exact: true });
  await tools.getByLabel('Insert X', { exact: true }).fill('100'); await tools.getByLabel('Insert Y', { exact: true }).fill('200');
  await tools.getByLabel('Object width', { exact: true }).fill('200'); await tools.getByLabel('Object height', { exact: true }).fill('90');
  await tools.getByRole('button', { name: 'Apply object changes', exact: true }).click();
  let objects = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects);
  expect(objects[0]).toMatchObject({ x: 100, y: 200, width: 200, height: 90 });
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click(); await tools.getByRole('button', { name: 'Duplicate object', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move shape rectangle', exact: true })).toHaveCount(2);
  objects = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects);
  expect(objects[1]).toMatchObject({ x: 120, y: 180, width: 200, height: 90 }); expect(objects[1].id).not.toBe(objects[0].id);
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click(); await tools.getByRole('button', { name: 'Remove object', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move shape rectangle', exact: true })).toHaveCount(1);
  await page.getByLabel('Undo', { exact: true }).click(); await expect(page.getByRole('button', { name: 'Move shape rectangle', exact: true })).toHaveCount(2);
  await page.getByLabel('Undo', { exact: true }).click(); await expect(page.getByRole('button', { name: 'Move shape rectangle', exact: true })).toHaveCount(1);
  await page.getByLabel('Undo', { exact: true }).click();
  expect((await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects))[0]).toMatchObject({ width: 140, height: 80 });
});

test('Object tools preserve image proportions and validate size and placement', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; const context = canvas.getContext('2d')!; context.fillStyle = '#ff0000'; context.fillRect(0, 0, 200, 100); return canvas.toDataURL().split(',')[1]; });
  await page.getByLabel('Add image', { exact: true }).setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click();
  const tools = page.getByRole('dialog', { name: 'Object tools', exact: true });
  await tools.getByLabel('Object width', { exact: true }).fill('240'); await expect(tools.getByLabel('Object height', { exact: true })).toHaveValue('120');
  await tools.getByLabel('Insert Y', { exact: true }).fill('450');
  await tools.getByLabel('Insert X', { exact: true }).fill('490'); await tools.getByRole('button', { name: 'Apply object changes', exact: true }).click();
  await expect(tools.getByRole('alert')).toContainText('inside the page');
  await tools.getByLabel('Insert X', { exact: true }).fill('40'); await tools.getByRole('button', { name: 'Apply object changes', exact: true }).click();
  await expect(page.locator('.image-object')).toHaveCSS('width', '240px'); await expect(page.locator('.image-object')).toHaveCSS('height', '120px');
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click();
  await tools.getByLabel('Keep image proportions', { exact: true }).uncheck(); await tools.getByLabel('Object height', { exact: true }).fill('60');
  await tools.getByRole('button', { name: 'Apply object changes', exact: true }).click(); await expect(page.locator('.image-object')).toHaveCSS('height', '60px');
  const screenshot = await page.locator('.image-object').screenshot();
  const edge = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close(); return Array.from(context.getImageData(5, canvas.height / 2, 1, 1).data);
  }, Array.from(screenshot));
  expect(edge).toEqual([255, 0, 0, 255]);
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await downloadPdf(await pending);
  const exportedPixels = await page.evaluate(async (bytes) => {
    const { openPdf } = await import('/src/lib/pdf.ts'); const data = new Uint8Array(bytes).buffer;
    const pdf = await openPdf({ id: 'image-check', name: 'image.pdf', data, size: data.byteLength, modifiedAt: 0 });
    try {
      const sheet = await pdf.getPage(1), viewport = sheet.getViewport({ scale: 1 });
      const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
      const context = canvas.getContext('2d')!; await sheet.render({ canvas, viewport }).promise;
      return [45, 275, 35].map((x) => Array.from(context.getImageData(x, viewport.height - 480, 1, 1).data));
    } finally { await pdf.loadingTask.destroy(); }
  }, Array.from(await pdf.save()));
  expect(exportedPixels).toEqual([[255, 0, 0, 255], [255, 0, 0, 255], [255, 255, 255, 255]]);
});

test('table copies have independent cells, reject overflow on resize, and recover with both exported tables', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add table', exact: true }).click(); await page.getByRole('button', { name: 'Insert table', exact: true }).click();
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click();
  let tools = page.getByRole('dialog', { name: 'Object tools', exact: true });
  await tools.getByLabel('Object height', { exact: true }).fill('20'); await tools.getByRole('button', { name: 'Apply object changes', exact: true }).click();
  await expect(tools.getByRole('alert')).toContainText('needs more space'); await tools.getByLabel('Object height', { exact: true }).fill('90');
  await tools.getByRole('button', { name: 'Duplicate object', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Inserted table' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit table', exact: true }).click(); await page.getByLabel('Cell 1:1', { exact: true }).fill('Copy header'); await page.getByRole('button', { name: 'Save table', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Header 1', exact: true })).toHaveCount(1); await expect(page.getByRole('columnheader', { name: 'Copy header', exact: true })).toHaveCount(1);
  await page.setViewportSize({ width: 600, height: 900 });
  const button = (await page.getByRole('button', { name: 'Object tools', exact: true }).boundingBox())!; expect(button.x + button.width).toBeLessThanOrEqual(600);
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click(); tools = page.getByRole('dialog', { name: 'Object tools', exact: true });
  await page.setViewportSize({ width: 390, height: 844 }); expect((await tools.boundingBox())!.width).toBeLessThanOrEqual(390); await page.keyboard.press('Escape');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 }); await page.reload();
  await expect(page.getByRole('table', { name: 'Inserted table' })).toHaveCount(2);
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); const pdf = await downloadPdf(await pending); expect(pageStreams(pdf).match(/0.941 0.933 0.984 rg/g)!.length).toBe(4);
});

test('form copies keep independent values and separate PDF fields', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text field', exact: true }).click();
  await page.getByLabel('Field value', { exact: true }).fill('Original value');
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click(); await page.getByRole('button', { name: 'Duplicate object', exact: true }).click();
  await page.getByLabel('Field value', { exact: true }).last().fill('Copy value');
  await expect(page.getByLabel('Field value', { exact: true }).first()).toHaveValue('Original value');
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await downloadPdf(await pending), form = pdf.getForm(), fields = form.getFields();
  expect(fields).toHaveLength(2); expect(fields[0].getName()).not.toBe(fields[1].getName());
  expect(fields.map((field) => form.getTextField(field.getName()).getText()).sort()).toEqual(['Copy value', 'Original value']);
});

test('moving a shape through Object tools updates connectors, and removal/undo preserves their relationship', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add shape', exact: true }).click(); await page.getByRole('button', { name: 'Add shape', exact: true }).click();
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Shapes & connectors', exact: true }).click(); await page.getByRole('button', { name: 'Connect shapes', exact: true }).click(); await page.getByLabel('Close Shapes & connectors', { exact: true }).click();
  const before = await page.locator('[data-connector]').getAttribute('d');
  await page.getByLabel('Inserted object', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click();
  await page.getByLabel('Insert X', { exact: true }).fill('250'); await page.getByLabel('Insert Y', { exact: true }).fill('200'); await page.getByRole('button', { name: 'Apply object changes', exact: true }).click();
  await expect(page.locator('[data-connector]')).not.toHaveAttribute('d', before!);
  await page.getByRole('button', { name: 'Insert', exact: true }).click(); await page.getByRole('button', { name: 'Object tools', exact: true }).click(); await page.getByRole('button', { name: 'Remove object', exact: true }).click();
  await expect(page.locator('[data-connector]')).toHaveCount(0);
  await page.getByLabel('Undo', { exact: true }).click(); await expect(page.locator('[data-connector]')).toHaveCount(1); await expect(page.getByRole('button', { name: 'Move shape rectangle', exact: true })).toHaveCount(2);
});
