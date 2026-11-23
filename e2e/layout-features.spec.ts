import { runPageCommand } from './workspace-helpers';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument, degrees } from 'pdf-lib';
import { downloadPdf, openAdvanced } from './advanced-helpers';

async function seedShapes(page: Page) {
  await page.evaluate(async () => {
    const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState();
    for (const shape of [{ id: 'a', label: 'A', x: 50, y: 100, width: 70, height: 40 }, { id: 'b', label: 'B', x: 170, y: 250, width: 100, height: 50 }, { id: 'c', label: 'C', x: 300, y: 400, width: 60, height: 30 }]) state.addObject({ ...shape, type: 'shape', page: 1, color: '#d65737', shapeKind: 'rectangle' });
  });
}
async function objects(page: Page) { return page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects); }
async function openArrange(page: Page) {
  await page.getByRole('button', { name: 'Layout', exact: true }).click(); await page.getByRole('button', { name: 'Align & distribute', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Align & distribute', exact: true }); await dialog.getByLabel('Select all layout objects').check(); return dialog;
}

test('Layout previews every alignment and applies all selected objects with one Undo, export, and recovery', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await openAdvanced(page); await seedShapes(page);
  const original = await objects(page), dialog = await openArrange(page);
  await dialog.getByLabel('Arrange page inset').fill('30');
  for (const [label, attribute, value] of [['Align left', 'x', '30'], ['Align center', 'x', '215'], ['Align right', 'x', '400'], ['Align top', 'y', '30'], ['Align middle', 'y', '305'], ['Align bottom', 'y', '580']]) {
    await dialog.getByRole('button', { name: 'Reset preview', exact: true }).click(); await dialog.getByRole('button', { name: label, exact: true }).click();
    await expect(dialog.getByRole('img', { name: 'Arrangement preview' }).locator('rect').nth(1)).toHaveAttribute(attribute, value);
  }
  expect(await objects(page)).toEqual(original);
  await dialog.getByRole('button', { name: 'Align right', exact: true }).click(); await dialog.getByRole('button', { name: 'Align top', exact: true }).click();
  const history = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().history.length);
  await dialog.getByRole('button', { name: 'Apply arrangement', exact: true }).click();
  const arranged = await objects(page);
  for (const object of arranged) { if (object.type === 'shape') { expect(object.x + object.width).toBe(470); expect(object.y + object.height).toBe(620); } }
  expect(await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().history.length)).toBe(history + 1);
  await page.getByLabel('Undo', { exact: true }).click(); expect(await objects(page)).toEqual(original); await page.getByLabel('Redo', { exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); expect((await downloadPdf(await pending)).getPageCount()).toBe(1);
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 }); await page.reload(); expect(await objects(page)).toEqual(arranged);
});

test('distribution uses equal gaps and selection alignment retains the group center', async ({ page }) => {
  await openAdvanced(page); await seedShapes(page); let dialog = await openArrange(page);
  await dialog.getByLabel('Arrange page inset').fill('20'); await dialog.getByRole('button', { name: 'Distribute horizontally', exact: true }).click(); await dialog.getByRole('button', { name: 'Apply arrangement', exact: true }).click();
  expect((await objects(page)).map((object) => 'x' in object ? object.x : 0)).toEqual([20, 205, 420]); await page.getByLabel('Undo', { exact: true }).click();
  dialog = await openArrange(page); await dialog.getByLabel('Arrange relative to').selectOption('selection');
  await dialog.getByRole('button', { name: 'Align center', exact: true }).click(); await dialog.getByRole('button', { name: 'Align middle', exact: true }).click(); await dialog.getByRole('button', { name: 'Apply arrangement', exact: true }).click();
  for (const object of await objects(page)) if (object.type === 'shape') { expect(object.x + object.width / 2).toBe(205); expect(object.y + object.height / 2).toBe(265); }
  await page.getByLabel('Undo', { exact: true }).click(); dialog = await openArrange(page); await dialog.getByLabel('Arrange page inset').fill('20');
  await dialog.getByRole('button', { name: 'Distribute vertically', exact: true }).click(); await dialog.getByRole('button', { name: 'Apply arrangement', exact: true }).click();
  const arranged = (await objects(page)).filter((object) => object.type === 'shape').sort((a, b) => a.y - b.y);
  expect(arranged[1].y - arranged[0].y - arranged[0].height).toBe(245); expect(arranged[2].y - arranged[1].y - arranged[1].height).toBe(245);
});

test('page rotation and ordering controls export the current source-page plan', async ({ page }) => {
  await openAdvanced(page, 2); await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move page up', exact: true })).toBeDisabled();
  await runPageCommand(page, 'Rotate left'); await expect(page.locator('.layout-context-bar')).toContainText('270° rotation');
  await runPageCommand(page, 'Rotate right'); await runPageCommand(page, 'Duplicate page');
  await expect(page.locator('.layout-context-bar')).toContainText('Page 2 of 3'); await runPageCommand(page, 'Move page down');
  await expect(page.getByRole('button', { name: 'Move page down', exact: true })).toBeDisabled(); await runPageCommand(page, 'Move page up');
  await runPageCommand(page, 'Delete page'); await page.getByLabel('Undo', { exact: true }).click(); await runPageCommand(page, 'Rotate left');
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); const pdf = await downloadPdf(await pending);
  expect(pdf.getPages().map((sheet) => sheet.getRotation().angle)).toEqual([270, 270, 0]);
});

test('alignment follows native rotation and offset crop bounds', async ({ page }) => {
  const pdf = await PDFDocument.create(); const sheet = pdf.addPage([650, 900]); sheet.setCropBox(120, 200, 400, 600); sheet.setRotation(degrees(90));
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'crop.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.evaluate(async () => { const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState(); for (const [index, y] of [300, 450, 600].entries()) state.addObject({ id: `shape-${index}`, type: 'shape', page: 1, x: 160 + index * 100, y, width: 70, height: 40, label: String(index), color: '#d65737' }); });
  const dialog = await openArrange(page); await dialog.getByLabel('Arrange page inset').fill('25'); await dialog.getByRole('button', { name: 'Align left', exact: true }).click(); await dialog.getByRole('button', { name: 'Apply arrangement', exact: true }).click();
  for (const object of await objects(page)) if ('y' in object) expect(object.y).toBe(225);
  const bounds = (await page.getByRole('article', { name: 'Page 1', exact: true }).boundingBox())!;
  for (const shape of await page.getByRole('button', { name: /^Move shape \d$/ }).all()) expect(Math.abs((await shape.locator('rect').first().boundingBox())!.x - bounds.x - 25)).toBeLessThan(1.1);
});

test('frame presets fit cropped pages and native source runs expose supported geometry', async ({ page }) => {
  const pdf = await PDFDocument.create(); pdf.addPage([650, 900]).setCropBox(120, 200, 400, 600);
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'crop.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Layout', exact: true }).click(); await page.getByRole('button', { name: 'Text flow & columns', exact: true }).click();
  await page.getByLabel('New frame preset').selectOption('three'); await page.getByRole('button', { name: 'Add text box', exact: true }).click();
  await expect(page.getByLabel('Text frame width')).toHaveValue('328'); await expect(page.getByLabel('Text frame height')).toHaveValue('528'); await expect(page.getByLabel('Text columns')).toHaveValue('3');
  await page.getByLabel('Text box content').fill('A page frame supports several columns. '.repeat(8)); await page.getByLabel('Close Text flow & columns').click();
  await expect(page.locator('.flow-text-object')).toHaveAttribute('viewBox', '0 0 328 528');
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); expect((await downloadPdf(await pending)).getPage(0).getCropBox()).toEqual({ x: 120, y: 200, width: 400, height: 600 });
  await openAdvanced(page, 1, 'Source run'); await page.locator('.text-layer span').filter({ hasText: 'Source run' }).dblclick(); await page.getByLabel('Edit PDF text').fill('Replacement run'); await page.getByLabel('Find text in document').click();
  await page.getByRole('button', { name: 'Layout', exact: true }).click(); await page.getByRole('button', { name: 'Text flow & columns', exact: true }).click();
  await expect(page.getByLabel('Text frame width')).toBeDisabled(); await expect(page.getByLabel('Text columns')).toBeDisabled(); await expect(page.getByLabel('Drop cap')).toBeDisabled(); await expect(page.getByLabel('Text frame x')).toBeEnabled();
  await page.getByLabel('Close Text flow & columns').click();
  await page.evaluate(async () => {
    const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState();
    state.addObject({ id: 'matched', type: 'text', page: 1, x: 40, y: 200, width: 200, height: 50, text: 'Matched paragraph', fontSize: 12, color: '#000000', cover: { width: 200, height: 50, color: '#e9f1dc' } });
    state.selectObject('matched');
  });
  await page.getByRole('button', { name: 'Text flow & columns', exact: true }).click();
  await expect(page.getByLabel('Text frame height')).toBeDisabled(); await expect(page.getByLabel('Text frame width')).toBeEnabled();
  await page.getByLabel('Text columns').selectOption('2'); await expect(page.getByLabel('Text frame height')).toBeEnabled();
  await page.getByLabel('Close Text flow & columns').click();
  await expect(page.locator('.text-block-object').last().locator('span').first()).toHaveCSS('background-color', 'rgb(233, 241, 220)');
});

test('arrangement rejects impossible spacing and stale objects, and closes safely at narrow widths', async ({ page }) => {
  await openAdvanced(page); await seedShapes(page); const original = await objects(page), dialog = await openArrange(page);
  await dialog.getByLabel('Arrange page inset').fill('200'); await dialog.getByRole('button', { name: 'Distribute horizontally', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('more space');
  expect(await objects(page)).toEqual(original); await dialog.getByLabel('Arrange page inset').fill('36'); await dialog.getByRole('button', { name: 'Center group on page', exact: true }).click();
  await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().updateObject('b', { color: '#222222' }));
  await dialog.getByRole('button', { name: 'Apply arrangement', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('document or page changed');
  await page.setViewportSize({ width: 390, height: 844 }); expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390); await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  const toolbar = (await page.locator('.layout-toolbar').boundingBox())!; expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(390);
});
