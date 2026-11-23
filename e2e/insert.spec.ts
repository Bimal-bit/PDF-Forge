import { runPageCommand } from './workspace-helpers';
import { expect, test, type Page } from '@playwright/test';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString, degrees } from 'pdf-lib';
import { downloadPdf, openAdvanced, pageStreams } from './advanced-helpers';

async function insert(page: Page) { await page.getByRole('button', { name: 'Insert', exact: true }).click(); }
async function objects(page: Page) {
  return page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects);
}

test('Insert organizes tools, adds a local date, and creates every quick shape and form kind', async ({ page }) => {
  await openAdvanced(page, 1, 'Select this source');
  await page.getByRole('button', { name: 'Select all text', exact: true }).click();
  await expect(page.getByLabel('Home selection details')).toContainText('1 text run');
  await insert(page);
  await expect(page.getByRole('group', { name: 'Insert commands' })).toBeVisible();
  await page.getByRole('button', { name: 'Insert date', exact: true }).click();
  const date = await page.evaluate(() => {
    const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  await expect(page.getByLabel('Overlay text')).toHaveValue(date);
  expect(await page.evaluate(async () => (await import('/src/store/useTextSelectionStore.ts')).useTextSelectionStore.getState().mode)).toBe('edit');
  for (const kind of ['rectangle', 'ellipse', 'diamond', 'terminator']) {
    await page.getByLabel('Insert shape type').selectOption(kind);
    await page.getByRole('button', { name: 'Add shape', exact: true }).click();
    await expect(page.getByRole('button', { name: `Move shape ${kind}`, exact: true })).toBeVisible();
  }
  for (const name of ['Add text field', 'Add checkbox', 'Add radio', 'Add dropdown', 'Add list', 'Add date field', 'Add button field', 'Add signature field']) await page.getByRole('button', { name, exact: true }).click();
  const added = await objects(page);
  expect(added.filter((object) => object.type === 'form').map((object) => object.kind).sort()).toEqual(['button', 'checkbox', 'date', 'dropdown', 'list', 'radio', 'signature', 'text']);
  for (const title of ['Shapes & connectors', 'Equation editor']) {
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible();
    await page.getByLabel(`Close ${title}`, { exact: true }).click();
  }
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const exported = await downloadPdf(await pending);
  expect(exported.getForm().getFields().length).toBe(7);
  expect(pageStreams(exported)).toContain('140 80 l');
});

test('table builder preserves resized cells, wraps values, edits atomically, and recovers/export Unicode', async ({ page }) => {
  await openAdvanced(page); await insert(page);
  await page.getByRole('button', { name: 'Add table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Insert table', exact: true });
  await dialog.getByLabel('Cell 1:1', { exact: true }).fill('Résumé Ω');
  await dialog.getByLabel('Table rows', { exact: true }).selectOption('3');
  await dialog.getByLabel('Table height', { exact: true }).fill('140');
  await dialog.getByLabel('Insert Y', { exact: true }).fill('400');
  await expect(dialog.getByLabel('Cell 1:1', { exact: true })).toHaveValue('Résumé Ω');
  await dialog.getByLabel('Cell 2:1', { exact: true }).fill('Long cell value wraps on multiple lines');
  await dialog.getByLabel('Cell 3:2', { exact: true }).fill('Final cell');
  await dialog.getByRole('button', { name: 'Insert table', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Résumé Ω', exact: true })).toBeVisible();
  await expect(page.locator('.table-object [role=cell]').filter({ hasText: 'Long cell' })).toContainText('\n');
  await page.getByRole('button', { name: 'Edit table', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit table', exact: true });
  await edit.getByLabel('Cell 3:2', { exact: true }).fill('Changed');
  await edit.getByLabel('Shade first row as header').uncheck();
  await edit.getByRole('button', { name: 'Save table', exact: true }).click();
  await expect(page.getByRole('columnheader')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Changed', exact: true })).toBeVisible();
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Final cell', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(2);
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const exported = await downloadPdf(await pending);
  expect(pageStreams(exported)).toContain('0.941 0.933 0.984 rg');
  const text = await page.evaluate(async (bytes) => {
    const { openPdf } = await import('/src/lib/pdf.ts'); const data = new Uint8Array(bytes).buffer;
    const pdf = await openPdf({ id: 'verify', name: 'table.pdf', data, size: data.byteLength, modifiedAt: 0 });
    try { return (await (await pdf.getPage(1)).getTextContent()).items.filter((item) => 'str' in item).map((item) => 'str' in item ? item.str : '').join(' '); } finally { await pdf.loadingTask.destroy(); }
  }, Array.from(await exported.save()));
  expect(text).toContain('Résumé Ω'); expect(text).toContain('Final cell');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await expect(page.getByRole('table', { name: 'Inserted table' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Résumé Ω', exact: true })).toBeVisible();
  await insert(page); await page.getByLabel('Inserted object').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Edit table', exact: true }).click();
  await expect(page.getByLabel('Cell 3:2', { exact: true })).toHaveValue('Final cell');
});

test('table validation blocks overflow, unsupported glyphs, and out of page placement without changes', async ({ page }) => {
  await openAdvanced(page); await insert(page);
  await page.getByRole('button', { name: 'Add table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Insert table', exact: true });
  await dialog.getByLabel('Table height', { exact: true }).fill('20');
  await dialog.getByRole('button', { name: 'Insert table', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('needs more space');
  await dialog.getByLabel('Table height', { exact: true }).fill('90');
  await dialog.getByLabel('Cell 1:1', { exact: true }).fill('🚀');
  await dialog.getByRole('button', { name: 'Insert table', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('characters unavailable');
  await dialog.getByLabel('Cell 1:1', { exact: true }).fill('Header');
  await dialog.getByLabel('Insert X', { exact: true }).fill('490');
  await dialog.getByRole('button', { name: 'Insert table', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('inside the page');
  expect(await objects(page)).toHaveLength(0);
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
});

test('links validate destinations, preserve display text, and update the exported annotation', async ({ page }) => {
  await openAdvanced(page); await insert(page);
  await page.getByRole('button', { name: 'Add link', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Insert link', exact: true });
  await dialog.getByLabel('Link destination', { exact: true }).fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Insert link', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Use an https://');
  expect(await objects(page)).toHaveLength(0);
  await dialog.getByLabel('Link destination', { exact: true }).fill('www.example.com/docs');
  await dialog.getByLabel('Link display text', { exact: true }).fill('Read the guide Ω');
  await dialog.getByRole('button', { name: 'Insert link', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Read the guide Ω', exact: true })).toHaveAttribute('href', 'https://www.example.com/docs');
  await page.getByRole('button', { name: 'Edit link', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit link', exact: true });
  await edit.getByLabel('Link destination', { exact: true }).fill('mailto:team@example.com');
  await edit.getByLabel('Link display text', { exact: true }).fill('Email our team');
  await edit.getByRole('button', { name: 'Save link', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Email our team', exact: true })).toHaveAttribute('href', 'mailto:team@example.com');
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await downloadPdf(await pending);
  const annotations = pdf.getPage(0).node.Annots()!;
  const link = annotations.lookup(0, PDFDict), action = link.lookup(PDFName.of('A'), PDFDict);
  expect(action.lookup(PDFName.of('URI'), PDFString).decodeText()).toBe('mailto:team@example.com');
  const rect = link.lookup(PDFName.of('Rect'), PDFArray).asArray().map((number) => Number(number.toString()));
  const width = await page.getByRole('link', { name: 'Email our team', exact: true }).evaluate((element) => element.getBoundingClientRect().width);
  expect(rect[2] - rect[0]).toBeCloseTo(width, 0);
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Read the guide Ω', exact: true })).toBeVisible();
});

test('images keep aspect ratio and transparency, support WebP, and report invalid files', async ({ page }) => {
  await openAdvanced(page); await insert(page);
  await page.getByLabel('Add image', { exact: true }).setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('alert')).toContainText('could not be decoded');
  await expect(page.locator('.image-object')).toHaveCount(0);
  const webp = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
    const context = canvas.getContext('2d')!; context.fillStyle = '#d65737'; context.fillRect(20, 20, 160, 60);
    return canvas.toDataURL('image/webp').split(',')[1];
  });
  await page.getByLabel('Add image', { exact: true }).setInputFiles({ name: 'wide.webp', mimeType: 'image/webp', buffer: Buffer.from(webp, 'base64') });
  await expect(page.locator('.image-object')).toHaveCSS('width', '180px');
  await expect(page.locator('.image-object')).toHaveCSS('height', '90px');
  await expect(page.locator('.image-object')).toHaveAttribute('src', /^data:image\/png/);
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await downloadPdf(await pending);
  expect(pdf.context.enumerateIndirectObjects().map(([, value]) => value.toString()).join('')).toContain('/SMask');
  await page.getByLabel('Undo', { exact: true }).click(); await expect(page.locator('.image-object')).toHaveCount(0);
});

test('placement respects rotated cropped pages and the current reordered source page', async ({ page }) => {
  const pdf = await PDFDocument.create(); pdf.addPage([500, 650]);
  const sheet = pdf.addPage([600, 800]); sheet.setCropBox(50, 80, 400, 600); sheet.setRotation(degrees(90));
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'crop.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByLabel('Go to page 2', { exact: true })).toBeVisible();
  await page.getByLabel('Go to page 2', { exact: true }).click();
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Move page up');
  await insert(page);
  for (const preset of ['top', 'middle', 'bottom']) {
    await page.getByLabel('Insert position').selectOption(preset);
    await page.getByRole('button', { name: 'Add shape', exact: true }).click();
    const latest = (await objects(page)).at(-1)!;
    expect(latest.page).toBe(2);
    const box = (await page.locator(`[data-editor-object-id="${latest.id}"]`).boundingBox())!;
    const bounds = (await page.getByRole('article', { name: 'Page 1', exact: true }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1); expect(box.y).toBeGreaterThanOrEqual(bounds.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  }
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const exported = await downloadPdf(await pending);
  expect(exported.getPage(0).getRotation().angle).toBe(90);
  expect(pageStreams(exported, 0)).toContain('140 80 l'); expect(pageStreams(exported, 1)).not.toContain('140 80 l');
});

test('a delayed image cannot insert into a page the user has left', async ({ page }) => {
  await openAdvanced(page, 2); await insert(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 50;
    const decode = window.createImageBitmap.bind(window);
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => new Promise<ImageBitmap>((resolve, reject) => {
      (window as unknown as { finishImage: () => void }).finishImage = () => { void Reflect.apply(decode, window, args).then(resolve, reject); };
    })) as typeof createImageBitmap;
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByLabel('Add image', { exact: true }).setInputFiles({ name: 'slow.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByLabel('Add image', { exact: true })).toBeDisabled();
  await page.getByLabel('Go to page 2', { exact: true }).click();
  await page.evaluate(() => (window as unknown as { finishImage: () => void }).finishImage());
  await expect(page.getByRole('alert')).toContainText('document or page changed');
  expect(await objects(page)).toHaveLength(0);
});

test('Insert reveals bottom objects and keeps its ribbon and dialogs usable at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await openAdvanced(page); await insert(page);
  await page.getByLabel('Insert position').selectOption('bottom');
  await page.getByRole('button', { name: 'Add table', exact: true }).click();
  await page.getByRole('button', { name: 'Insert table', exact: true }).click();
  const box = (await page.getByRole('table', { name: 'Inserted table' }).boundingBox())!;
  const canvas = (await page.locator('.canvas').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(canvas.y + canvas.height - 20);
  await page.setViewportSize({ width: 390, height: 844 });
  const ribbon = (await page.locator('.insert-toolbar').boundingBox())!;
  expect(ribbon.x + ribbon.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Edit table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit table', exact: true });
  const bounds = (await dialog.boundingBox())!; expect(bounds.width).toBeLessThanOrEqual(390);
  await expect(dialog.getByLabel('Cell 1:1', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
});
