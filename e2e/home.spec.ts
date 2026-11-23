import { runPageCommand } from './workspace-helpers';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFArray, PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';

async function open(page: Page, pdf?: PDFDocument) {
  const document = pdf ?? (await PDFDocument.create());
  if (!document.getPageCount()) document.addPage([420, 550]);
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({
    name: 'home.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await document.save()),
  });
  const paper = page.getByRole('article', { name: 'Page 1', exact: true });
  if ((page.viewportSize()?.width ?? 1440) <= 760) {
    await expect(paper).toHaveAttribute('data-rendered', 'true');
    expect((await paper.boundingBox())!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  } else await expect(paper.locator('canvas')).toHaveJSProperty('width', Math.ceil(document.getPage(0).getWidth() * 1.5));
}

test('Home starts with guidance and supports insertion, Find, font steps, text case, history, and export', async ({
  page,
}) => {
  await open(page);
  await expect(page.getByLabel('Home selection details')).toContainText('Click text on the page');
  await expect(page.getByLabel('Font size', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Copy formatting', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(page.getByLabel('Find text in document')).toBeFocused();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').fill('hello from home');
  await expect(page.getByLabel('Text statistics')).toHaveText('3 words · 15 characters');
  await page.getByRole('button', { name: 'Increase font size', exact: true }).click();
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('15');
  await page.getByRole('button', { name: 'Decrease font size', exact: true }).click();
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('14');
  await page.getByLabel('Font size', { exact: true }).fill('144');
  await expect(
    page.getByRole('button', { name: 'Increase font size', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Font size', { exact: true }).fill('6');
  await expect(
    page.getByRole('button', { name: 'Decrease font size', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Font size', { exact: true }).fill('14');
  await page.getByLabel('Change text case').selectOption('upper');
  await expect(page.getByLabel('Overlay text')).toHaveValue('HELLO FROM HOME');
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('hello from home');
  await page.getByLabel('Redo', { exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('HELLO FROM HOME');
  await page.getByLabel('Change text case').selectOption('title');
  await expect(page.getByLabel('Overlay text')).toHaveValue('Hello From Home');
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await PDFDocument.load(await readFile((await (await pending).path())!));
  const streams = result.getPage(0).node.Contents() as PDFArray;
  const content = Array.from({ length: streams.size() }, (_, index) =>
    new TextDecoder().decode(decodePDFRawStream(streams.lookup(index, PDFRawStream)).decode()),
  ).join('\n');
  expect(content).toContain('48656C6C6F2046726F6D20486F6D65');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
  await page.reload();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Hello From Home');
});

test('format painter preserves target content and geometry, resets omitted styles, and undoes atomically', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Original title');
  await page.getByLabel('Font family', { exact: true }).selectOption('Courier');
  await page.getByLabel('Font size', { exact: true }).fill('22');
  await page.getByLabel('Text color', { exact: true }).fill('#123456');
  await page.getByLabel('Text alignment', { exact: true }).selectOption('right');
  await page.getByLabel('Line spacing', { exact: true }).fill('1.7');
  await page.getByRole('button', { name: 'Copy formatting', exact: true }).click();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').nth(1).fill('Second body');
  await page.getByLabel('italic', { exact: true }).click();
  const targetPosition = await page.locator('.text-object').filter({ hasText: 'Second body' }).evaluate((element) => ({ left: getComputedStyle(element).left, bottom: getComputedStyle(element).bottom }));
  await page.getByRole('button', { name: 'Paste formatting', exact: true }).click();
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('Courier');
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('22');
  await expect(page.getByLabel('Text alignment', { exact: true })).toHaveValue('right');
  await expect(page.getByLabel('Line spacing', { exact: true })).toHaveValue('1.7');
  await expect(page.getByLabel('italic', { exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Overlay text').nth(1)).toHaveValue('Second body');
  const target = page.locator('.text-object').filter({ hasText: 'Second body' });
  await expect(target).toHaveCSS('left', targetPosition.left);
  await expect(target).toHaveCSS('bottom', targetPosition.bottom);
  await expect(page.getByLabel('Text block width')).toHaveValue('300');
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('14');
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('Helvetica');
  await expect(page.getByLabel('italic', { exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Redo', { exact: true }).click();
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('22');
  const next = await PDFDocument.create();
  next.addPage([420, 550]);
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({
    name: 'next.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await next.save()),
  });
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Paste formatting', exact: true })).toBeDisabled();
});

test('Home transforms an unchanged native source selection and tracks its text change', async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([420, 550]).drawText('a source sentence', {
    x: 35,
    y: 420,
    size: 18,
    font: await pdf.embedFont(StandardFonts.Helvetica),
  });
  await open(page, pdf);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  await page.getByLabel('Track text changes', { exact: true }).check();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.locator('.text-layer span').filter({ hasText: 'a source sentence' }).click();
  await expect(page.getByLabel('Edit PDF text')).toHaveText('a source sentence');
  await page.getByLabel('Change text case').click();
  await page.getByLabel('Change text case').selectOption('sentence');
  await expect(page.getByLabel('Overlay text')).toHaveValue('A source sentence');
  await expect(page.locator('.text-object')).toHaveCSS('font-size', '18px');
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(0);
  await page.getByLabel('Redo', { exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('A source sentence');
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Tracked changes' })).toContainText(
    'a source sentence',
  );
  await expect(page.getByRole('dialog', { name: 'Tracked changes' })).toContainText(
    'A source sentence',
  );
});

test('Home insertion respects page order and block selection navigates to the correct page', async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([420, 550]);
  pdf.addPage([420, 550]);
  await open(page, pdf);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Move page down');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').fill('On reordered second page');
  await expect(
    page.getByRole('article', { name: 'Page 2', exact: true }).locator('.text-object'),
  ).toHaveText('On reordered second page');
  await page.getByLabel('Go to page 1', { exact: true }).click();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').nth(1).fill('On first page');
  await page
    .getByLabel('Text block', { exact: true })
    .selectOption({ label: 'On reordered second page' });
  await expect(page.getByLabel('Go to page 2', { exact: true })).toHaveClass(/active/);
});

for (const width of [1440, 900, 390]) {
  test(`Home keeps selection details visible and all command groups reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await expect(page.getByLabel('Text block', { exact: true })).toBeInViewport();
    await expect(page.getByLabel('Text statistics')).toBeInViewport();
    await page.getByRole('button', { name: 'Styles & snippets', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Styles & snippets' })).toBeVisible();
    await page.keyboard.press('Escape');
    const commands = page.getByRole('region', { name: 'Home commands' });
    await commands.focus();
    await page.keyboard.press('Home');
    await commands.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await expect(page.getByRole('button', { name: 'Add text', exact: true })).toBeInViewport();
    await expect(page.getByLabel('Text block', { exact: true })).toBeInViewport();
    expect((await commands.boundingBox())!.width).toBeLessThanOrEqual(width);
  });
}
