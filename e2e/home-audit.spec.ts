import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib';

async function open(page: Page, source = false) {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([600, 600]);
  if (source)
    sheet.drawText('Source text for the Home audit', {
      x: 40,
      y: 500,
      size: 18,
      font: await pdf.embedFont(StandardFonts.Helvetica),
    });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({
    name: 'home-audit.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  });
  await expect(
    page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas'),
  ).toHaveJSProperty('width', 900);
}

async function exportedLines(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const bytes = await readFile((await (await pending).path())!);
  return page.evaluate(async (bytes) => {
    const { openPdf } = await import('/src/lib/pdf.ts');
    const data = new Uint8Array(bytes).buffer;
    const pdf = await openPdf({
      id: crypto.randomUUID(),
      name: 'audit-export.pdf',
      size: data.byteLength,
      data,
      modifiedAt: 0,
    });
    try {
      const content = await (await pdf.getPage(1)).getTextContent();
      const lines: { text: string; x: number; y: number }[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue;
        let line = lines.find((line) => Math.abs(line.y - item.transform[5]) < 0.1);
        if (!line) {
          line = { text: '', x: item.transform[4], y: item.transform[5] };
          lines.push(line);
        }
        line.text += item.str;
        line.x = Math.min(line.x, item.transform[4]);
      }
      return lines;
    } finally {
      await pdf.loadingTask.destroy();
    }
  }, Array.from(bytes));
}

test('bullets, wrapping, spacing, indentation, and all alignments preview the same lines as the exported PDF', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Alpha beta gamma delta epsilon.\nSecond list item.');
  await page.getByLabel('Font family', { exact: true }).selectOption('Courier');
  await page.getByLabel('Font size', { exact: true }).fill('16');
  await page.getByLabel('Text block width', { exact: true }).fill('160');
  await page.getByLabel('Text indent', { exact: true }).fill('12');
  await page.getByLabel('Line spacing', { exact: true }).fill('1.6');
  await page.getByLabel('Character spacing', { exact: true }).fill('0.8');
  await page.getByLabel('List style', { exact: true }).selectOption('bullet');
  const expected = ['• Alpha beta', 'gamma delta', 'epsilon.', '• Second list', 'item.'];
  await expect(page.locator('.paragraph-line')).toHaveText(expected);
  for (const alignment of ['left', 'center', 'right', 'justify']) {
    await page.getByLabel('Text alignment', { exact: true }).selectOption(alignment);
    const lines = await exportedLines(page);
    expect(lines.map((line) => line.text.replace(/\s/g, ''))).toEqual(
      expected.map((line) => line.replace(/\s/g, '')),
    );
    const canvas = (await page
      .getByRole('article', { name: 'Page 1', exact: true })
      .locator('canvas')
      .boundingBox())!;
    const preview = await page.locator('.paragraph-line').evaluateAll((elements) =>
      elements.map((element) => ({
        x: element.getBoundingClientRect().left,
        y: element.getBoundingClientRect().top,
      })),
    );
    for (let index = 0; index < lines.length; index++) {
      expect(Math.abs(preview[index].x - canvas.x - lines[index].x)).toBeLessThan(1.5);
      if (index)
        expect(
          Math.abs(preview[index].y - preview[index - 1].y - (lines[index - 1].y - lines[index].y)),
        ).toBeLessThan(0.2);
    }
  }
  await page.getByRole('button', { name: 'Select all text', exact: true }).click();
  await expect(page.getByLabel('Home selection details')).toContainText('1 text runs selected');
  const paragraph = (await page.locator('.paragraph-line').first().boundingBox())!;
  const selectable = (await page
    .locator('.selection-layer .selectable-run')
    .first()
    .boundingBox())!;
  expect(Math.abs(paragraph.x - selectable.x)).toBeLessThan(1);
  expect(Math.abs(paragraph.width - selectable.width)).toBeLessThan(1);
  await page.getByLabel('List style', { exact: true }).selectOption('number');
  await expect(page.locator('.text-object')).toContainText('1. Alpha');
  await expect(page.locator('.text-object')).toContainText('2. Second');
});

test('Home enforces numeric bounds before they reach rendering or PDF export', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Safe numeric settings');
  for (const [label, value, expected] of [
    ['Text indent', '-999', '0'],
    ['Text indent', '999', '200'],
    ['Line spacing', '-3', '0.8'],
    ['Line spacing', '99', '4'],
    ['Character spacing', '-99', '-2'],
    ['Character spacing', '99', '20'],
    ['Text block width', '9999', '2000'],
  ] as const) {
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel(label, { exact: true }).press('Tab');
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(expected);
  }
  await page.getByLabel('Text indent', { exact: true }).fill('0');
  const result = await exportedLines(page);
  expect(result.every((line) => Number.isFinite(line.x) && Number.isFinite(line.y))).toBe(true);
});

test('numeric Home fields accept normal keyboard editing of small, decimal, and negative values', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  for (const [label, value] of [
    ['Font size', '14'],
    ['Line spacing', '0.9'],
    ['Character spacing', '-1.5'],
  ]) {
    const input = page.getByLabel(label, { exact: true });
    await input.focus();
    await input.press('Control+a');
    await input.pressSequentially(value);
    await expect(input).toHaveValue(value);
    await input.press('Tab');
    await expect(input).toHaveValue(value);
  }
});

test('font import works for an unchanged staged source selection', async ({ page }) => {
  await open(page, true);
  await page
    .locator('.text-layer span')
    .filter({ hasText: 'Source text for the Home audit' })
    .click();
  await expect(page.getByLabel('Import matching font')).toBeEnabled();
  await page
    .getByLabel('Import matching font')
    .setInputFiles('public/fonts/catalog/inter/400-normal.ttf');
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('Inter');
  await expect(page.getByLabel('Overlay text')).toHaveValue('Source text for the Home audit');
  expect((await exportedLines(page)).map((line) => line.text).join('\n')).toContain(
    'Source text for the Home audit',
  );
});

test('font import preserves newer text committed while the file was loading', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      const result = await original.call(this);
      if (this.name === 'slow-audit.ttf') await new Promise((resolve) => setTimeout(resolve, 500));
      return result;
    };
  });
  await open(page, true);
  await page
    .locator('.text-layer span')
    .filter({ hasText: 'Source text for the Home audit' })
    .click();
  await expect(page.getByLabel('Import matching font')).toBeEnabled();
  await page.getByLabel('Import matching font').setInputFiles({
    name: 'slow-audit.ttf',
    mimeType: 'font/ttf',
    buffer: await readFile('public/fonts/catalog/inter/400-normal.ttf'),
  });
  await page.getByLabel('Edit PDF text').fill('Latest typed content');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('Inter');
  await expect(page.getByLabel('Overlay text')).toHaveCount(1);
  await expect(page.getByLabel('Overlay text')).toHaveValue('Latest typed content');
});

test('the library rejects source-only font presets before saving unusable cross-file styles', async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([600, 600]).drawText('Uncommon font sample', { x: 40, y: 500, size: 18, font });
  await pdf.flush();
  pdf.context.lookup(font.ref, PDFDict).set(PDFName.of('BaseFont'), PDFName.of('Arial'));
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({
    name: 'uncommon.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  });
  await page.locator('.text-layer span').filter({ hasText: 'Uncommon font sample' }).click();
  await expect(page.getByLabel('Font size', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Styles & snippets' });
  await library.getByLabel('Library entry name').fill('Unsupported source style');
  await library.getByRole('button', { name: 'Save selected style', exact: true }).click();
  await expect(library.getByRole('status')).toContainText('Choose a bundled font or import');
  await expect(
    library.getByRole('button', { name: 'Apply Unsupported source style', exact: true }),
  ).toHaveCount(0);
  await library.getByLabel('Close editing library').click();
  await page.evaluate(async () => {
    const { saveLibraryEntry } = await import('/src/lib/editingLibrary.ts');
    await saveLibraryEntry({
      id: 'legacy-font',
      kind: 'style',
      name: 'Legacy source style',
      styleKind: 'paragraph',
      format: { fontFamily: 'Arial', fontSize: 18, color: '#000000' },
    });
  });
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  await library.getByRole('button', { name: 'Apply Legacy source style', exact: true }).click();
  await expect(library.getByRole('status')).toContainText('Choose a bundled font or import');
  await library.getByLabel('Close editing library').click();
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('Helvetica');
});

test('an inserted paragraph keeps its glyph position when caret editing begins', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Stable paragraph caret');
  await page.getByLabel('Font size', { exact: true }).fill('18');
  const ink = (element: Element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().toJSON();
  };
  const before = await page.locator('.paragraph-line').evaluate(ink);
  await page.locator('.paragraph-line').click();
  await expect(page.getByLabel('Edit PDF text')).toBeFocused();
  const after = await page.getByLabel('Edit PDF text').evaluate(ink);
  expect(Math.abs(before.x - after.x)).toBeLessThan(1);
  expect(Math.abs(before.y - after.y)).toBeLessThan(1);
  expect(Math.abs(before.width - after.width)).toBeLessThan(1);
});

test('source text offers supported font controls and explains unavailable paragraph layout', async ({
  page,
}) => {
  await open(page, true);
  await page
    .locator('.text-layer span')
    .filter({ hasText: 'Source text for the Home audit' })
    .click();
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(page.getByLabel('Font size', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Character spacing', { exact: true })).toBeEnabled();
  for (const label of ['Text alignment', 'List style', 'Text indent', 'Text block width'])
    await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Home selection details')).toContainText(
    'Paragraph layout applies to inserted text boxes',
  );
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  for (const label of ['Text alignment', 'List style', 'Text indent', 'Text block width'])
    await expect(page.getByLabel(label, { exact: true })).toBeEnabled();
});

test('inserting a library snippet leaves group selection and exposes the new block for formatting', async ({
  page,
}) => {
  await open(page, true);
  await page.getByRole('button', { name: 'Select all text', exact: true }).click();
  await expect(page.getByLabel('Home selection details')).toContainText('1 text runs selected');
  await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Styles & snippets' });
  await library.getByRole('button', { name: 'Snippets', exact: true }).click();
  await library.getByLabel('Library entry name').fill('Audit snippet');
  await library.getByLabel('Snippet text').fill('Inserted from the library');
  await library.getByRole('button', { name: 'Save snippet', exact: true }).click();
  await library.getByRole('button', { name: 'Insert Audit snippet', exact: true }).click();
  await library.getByLabel('Close editing library').click();
  await expect(page.getByRole('button', { name: 'Select text', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByLabel('Font size', { exact: true })).toBeEnabled();
  await page.getByLabel('Font size', { exact: true }).fill('20');
  await expect(
    page.locator('.text-object').filter({ hasText: 'Inserted from the library' }),
  ).toHaveCSS('font-size', '20px');
});

test('all style presets, emphasis toggles, and Clear formatting leave a consistent body state', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Home style audit');
  for (const [style, size] of [
    ['Heading 1', '28'],
    ['Heading 2', '22'],
    ['Heading 3', '16'],
    ['Caption', '10'],
    ['Body', '12'],
  ]) {
    await page.getByLabel('Text style', { exact: true }).selectOption(style);
    await expect(page.getByLabel('Font size', { exact: true })).toHaveValue(size);
  }
  for (const label of ['bold', 'italic', 'underline', 'strike'])
    await page.getByLabel(label, { exact: true }).click();
  await page.getByLabel('Text color', { exact: true }).fill('#123456');
  await page.getByLabel('Text alignment', { exact: true }).selectOption('right');
  await page.getByRole('button', { name: 'Clear formatting', exact: true }).click();
  for (const label of ['bold', 'italic', 'underline', 'strike'])
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Text color', { exact: true })).toHaveValue('#292724');
  await expect(page.getByRole('button', { name: 'Body', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('Text alignment', { exact: true })).toHaveValue('left');
  await expect(page.getByLabel('Overlay text')).toHaveValue('Home style audit');
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.getByLabel('Text color', { exact: true })).toHaveValue('#123456');
  await page.getByLabel('Redo', { exact: true }).click();
  await expect(page.getByLabel('Text color', { exact: true })).toHaveValue('#292724');
});

test('Home text insertion reveals the new block on a tall page in a short window', async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.goto('/');
  await page
    .getByLabel('Open PDF', { exact: true })
    .setInputFiles({
      name: 'tall.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await pdf.save()),
    });
  await expect(
    page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas'),
  ).toHaveJSProperty('width', 918);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await expect(page.locator('.text-object')).toBeInViewport({ ratio: 1 });
});
