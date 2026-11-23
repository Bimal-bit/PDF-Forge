import { runPageCommand } from './workspace-helpers';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { downloadPdf, pageStreams } from './advanced-helpers';

async function fixture(pages = 1) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pages; index++) {
    const sheet = pdf.addPage([420, 540]);
    sheet.drawText(`First line page ${index + 1}`, {
      x: 35,
      y: 440,
      size: 16,
      font: await pdf.embedFont(StandardFonts.Helvetica),
      color: rgb(0.1, 0.2, 0.3),
    });
    sheet.drawText(`Second line page ${index + 1}`, {
      x: 35,
      y: 412,
      size: 16,
      font: await pdf.embedFont(StandardFonts.HelveticaBold),
      color: rgb(0.3, 0.2, 0.1),
    });
    sheet.drawText(`Third line page ${index + 1}`, {
      x: 35,
      y: 384,
      size: 16,
      font: await pdf.embedFont(StandardFonts.HelveticaOblique),
      color: rgb(0.1, 0.3, 0.2),
    });
  }
  return pdf;
}

async function open(page: Page, pdf: PDFDocument) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({
    name: 'selection.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  });
  await expect(
    page.locator('.text-layer span').filter({ hasText: 'Third line page 1' }),
  ).toBeVisible();
}

async function copiedText(page: Page) {
  return page.evaluate(() => {
    const data = new DataTransfer();
    document.dispatchEvent(
      new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: data }),
    );
    return data.getData('text/plain');
  });
}

test('Select all preserves mixed source colors and solid backgrounds on an offscreen page', async ({
  page,
}) => {
  const pdf = await fixture(3);
  const last = pdf.addPage([420, 540]);
  last.drawRectangle({ x: 0, y: 0, width: 420, height: 540, color: rgb(0.9, 0.8, 0.7) });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  last.drawText('Red words ', { x: 35, y: 440, font, size: 16, color: rgb(1, 0, 0) });
  last.drawText('blue words', {
    x: 35 + font.widthOfTextAtSize('Red words ', 16),
    y: 440,
    font,
    size: 16,
    color: rgb(0, 0, 1),
  });
  await open(page, pdf);
  await page.getByRole('button', { name: 'Select all text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Selecting text…', exact: true })).toHaveCount(0, {
    timeout: 15000,
  });
  await page.getByLabel('Font size', { exact: true }).fill('18');
  const color = await page.evaluate(async () => {
    const store = await import('/src/store/useAppStore.ts');
    return store.useAppStore
      .getState()
      .objects.filter(
        (object: { type: string; page: number }) => object.type === 'text' && object.page === 4,
      )
      .map((object: { text: string; color: string; cover?: { color?: string } }) => ({
        text: object.text,
        color: object.color,
        background: object.cover?.color,
      }));
  });
  expect(color.find((run: { text: string }) => run.text.includes('Red words'))).toMatchObject({
    color: '#ff0000',
    background: '#e6ccb2',
  });
  expect(color.find((run: { text: string }) => run.text.includes('blue words'))).toMatchObject({
    color: '#0000ff',
    background: '#e6ccb2',
  });
});

test('Ctrl+A leaves a single-line caret editor and formats all document text with atomic undo and export', async ({
  page,
}) => {
  await open(page, await fixture());
  await page.locator('.text-layer span').filter({ hasText: 'First line page 1' }).click();
  await expect(page.getByLabel('Edit PDF text')).toBeFocused();
  await page.keyboard.press('Control+a');
  await expect(page.getByLabel('Edit PDF text')).toHaveCount(0);
  await expect(page.getByLabel('Home selection details')).toContainText('3 text runs selected');
  expect(await copiedText(page)).toBe('First line page 1\nSecond line page 1\nThird line page 1');
  await page.getByLabel('Font size', { exact: true }).fill('20');
  await expect(page.locator('.text-object')).toHaveCount(3);
  for (const object of await page.locator('.text-object').all())
    await expect(object).toHaveCSS('font-size', '20px');
  await expect(page.locator('.text-object').filter({ hasText: 'Second line' })).toHaveCSS(
    'font-weight',
    '700',
  );
  await expect(page.locator('.text-object').filter({ hasText: 'Third line' })).toHaveCSS(
    'font-style',
    'italic',
  );
  await expect(page.locator('.text-object').filter({ hasText: 'First line' })).toHaveCSS(
    'color',
    'rgb(26, 51, 76)',
  );
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await downloadPdf(await pending);
  expect(pageStreams(result)).toContain('20 Tf');
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(0);
  await page.getByLabel('Redo', { exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(3);
});

for (const editing of [false, true]) {
  test(`dragging across three lines ${editing ? 'from an active caret' : 'from source text'} selects and formats them together`, async ({
    page,
  }) => {
    await open(page, await fixture());
    const first = page.locator('.text-layer span').filter({ hasText: 'First line page 1' });
    const third = page.locator('.text-layer span').filter({ hasText: 'Third line page 1' });
    if (editing) {
      await first.click();
      await expect(page.getByLabel('Edit PDF text')).toBeFocused();
    }
    const start = (await (editing ? page.getByLabel('Edit PDF text') : first).boundingBox())!;
    const end = (await third.boundingBox())!;
    await page.mouse.move(start.x + 1, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width - 1, end.y + end.height / 2, { steps: 16 });
    await page.mouse.up();
    await expect(page.getByLabel('Home selection details')).toContainText('3 text runs selected');
    expect(await copiedText(page)).toContain('Second line page 1');
    expect(await page.evaluate(() => window.getSelection()?.toString())).toContain(
      'Second line page 1',
    );
    await page.getByLabel('Text color', { exact: true }).fill('#123456');
    await expect(page.locator('.text-object')).toHaveCount(3);
    for (const object of await page.locator('.text-object').all())
      await expect(object).toHaveCSS('color', 'rgb(18, 52, 86)');
    await page.getByLabel('Undo', { exact: true }).click();
    await expect(page.locator('.text-object')).toHaveCount(0);
  });
}

test('Select all includes offscreen pages, excludes covered source text, and keeps main canvases lazy', async ({
  page,
}) => {
  await open(page, await fixture(6));
  await page.locator('.text-layer span').filter({ hasText: 'First line page 1' }).click();
  await page.getByLabel('Edit PDF text').fill('Current edited first line');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  const visited = await page
    .locator('.pdf-page > canvas')
    .evaluateAll(
      (canvases) => canvases.filter((canvas) => (canvas as HTMLCanvasElement).width > 300).length,
    );
  await page.getByRole('button', { name: 'Select all text', exact: true }).click();
  await expect(page.getByLabel('Home selection details')).toContainText('18 text runs selected', {
    timeout: 15000,
  });
  const copied = await copiedText(page);
  expect(copied).toContain('Third line page 6');
  expect(copied).toContain('Current edited first line');
  expect(copied).not.toContain('First line page 1');
  expect(copied).not.toContain('PDFForge');
  expect(copied.split('\n')).toHaveLength(18);
  expect(
    await page
      .locator('.pdf-page > canvas')
      .evaluateAll(
        (canvases) => canvases.filter((canvas) => (canvas as HTMLCanvasElement).width > 300).length,
      ),
  ).toBe(visited);
  await page.getByLabel('underline', { exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(18);
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await expect(page.getByLabel('Overlay text')).toHaveCount(18);
});

test('explicit selection mode supports native multiline drag, respects input Select all, and Escape restores caret editing', async ({
  page,
}) => {
  await open(page, await fixture());
  await page.getByRole('button', { name: 'Select text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select text', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const first = (await page.locator('.selection-layer .selectable-run').first().boundingBox())!;
  const last = (await page.locator('.selection-layer .selectable-run').last().boundingBox())!;
  await page.mouse.move(first.x + 1, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width - 1, last.y + last.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByLabel('Home selection details')).toContainText('3 text runs selected');
  await page.getByLabel('Change text case').selectOption('upper');
  for (const text of await page.getByLabel('Overlay text').all())
    expect(await text.inputValue()).toMatch(/LINE PAGE/);
  await page.getByLabel('Find text in document').fill('search only');
  await page.keyboard.press('Control+a');
  expect(
    await page
      .getByLabel('Find text in document')
      .evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!),
  ).toBe(11);
  await page.getByRole('region', { name: 'Selectable text on page 1' }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Select text', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.locator('.text-object').first().click();
  await expect(page.getByLabel('Edit PDF text')).toBeFocused();
});

test('selection formatting survives zoom and rotation and changes only surviving pages', async ({
  page,
}) => {
  await open(page, await fixture(2));
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Delete page');
  await runPageCommand(page, 'Rotate page');
  await runPageCommand(page, 'Duplicate page');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Select all text', exact: true }).click();
  await expect(page.getByLabel('Home selection details')).toContainText('3 text runs selected');
  expect(await copiedText(page)).not.toContain('page 1');
  expect((await copiedText(page)).split('\n')).toHaveLength(6);
  await page.getByLabel('bold', { exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(6);
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await downloadPdf(await pending);
  expect(result.getPageCount()).toBe(2);
  expect(result.getPage(0).getRotation().angle).toBe(90);
});

test('opening another document clears the old selection before Home can edit the new file', async ({
  page,
}) => {
  await open(page, await fixture());
  await page.getByRole('button', { name: 'Select all text', exact: true }).click();
  await expect(page.getByLabel('Home selection details')).toContainText('3 text runs selected');
  const next = await PDFDocument.create();
  next.addPage([420, 540]);
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({
    name: 'new.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await next.save()),
  });
  await expect(page.getByRole('button', { name: 'Select text', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByLabel('Font size', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').fill('New document only');
  await page.getByLabel('bold', { exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(1);
  await expect(page.locator('.text-object')).toHaveText('New document only');
});

test('rapid successive formatting replaces selection layers without uncaught pdf.js errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page, await fixture());
  await page.getByRole('button', { name: 'Select all text', exact: true }).click();
  await expect(page.getByLabel('Home selection details')).toContainText('3 text runs selected');
  for (let index = 0; index < 4; index++) {
    await page.getByLabel('bold', { exact: true }).click();
    await page.getByLabel('Text color', { exact: true }).fill(index % 2 ? '#123456' : '#654321');
  }
  await page.getByLabel('underline', { exact: true }).click();
  await expect(page.locator('.selected-text-run')).toHaveCount(3);
  for (const object of await page.locator('.text-object').all())
    await expect(object).toHaveCSS('color', 'rgb(18, 52, 86)');
  expect(errors).toEqual([]);
});
