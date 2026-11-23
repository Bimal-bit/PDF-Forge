import { expect, test, type Page } from '@playwright/test';
import {
  PDFDict,
  PDFDocument,
  PDFName,
  StandardFonts,
  rgb,
  setCharacterSpacing,
  setCharacterSqueeze,
  pushGraphicsState,
  popGraphicsState,
} from 'pdf-lib';
import { downloadPdf, pageStreams } from './advanced-helpers';

async function open(page: Page, pdf: PDFDocument) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({
    name: 'inline.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  });
}

test('inline editing keeps source size, color, bold, italic, underline, and baseline without a visible box', async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([500, 650]);
  sheet.drawRectangle({
    x: 0,
    y: 0,
    width: 500,
    height: 650,
    color: rgb(240 / 255, 230 / 255, 210 / 255),
  });
  const font = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const text = 'Native styled text';
  const size = 17.5;
  const width = font.widthOfTextAtSize(text, size);
  sheet.drawText(text, { x: 40, y: 550, font, size, color: rgb(0.2, 0.3, 0.8) });
  sheet.drawLine({
    start: { x: 40, y: 548 },
    end: { x: 40 + width, y: 548 },
    thickness: 0.8,
    color: rgb(0.2, 0.3, 0.8),
  });
  await open(page, pdf);
  await page.addStyleTag({ content: '.inplace-editor { caret-color: transparent !important; }' });
  const run = page.locator('.text-layer span').filter({ hasText: text });
  const bounds = (await run.boundingBox())!;
  const clip = {
    x: Math.floor(bounds.x) - 4,
    y: Math.floor(bounds.y) - 8,
    width: Math.ceil(bounds.width) + 12,
    height: Math.ceil(bounds.height) + 20,
  };
  const inkBounds = async () => {
    const bytes = await page.screenshot({ clip });
    return page.evaluate(async (bytes) => {
      const bitmap = await createImageBitmap(
        new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
      );
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const points = [];
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (pixels[i + 2] - pixels[i] > 70 && pixels[i + 2] - pixels[i + 1] > 50)
            points.push([x, y]);
        }
      return {
        left: Math.min(...points.map((p) => p[0])),
        right: Math.max(...points.map((p) => p[0])),
        top: Math.min(...points.map((p) => p[1])),
        bottom: Math.max(...points.map((p) => p[1])),
      };
    }, Array.from(bytes));
  };
  const before = await inkBounds();
  await expect(run).toHaveCSS('cursor', 'default');
  await run.click();
  const editor = page.getByLabel('Edit PDF text');
  await expect(editor).toBeFocused();
  await expect(editor).toHaveAttribute('contenteditable', 'plaintext-only');
  await expect(editor).toHaveCSS('border-style', 'none');
  await expect(editor).toHaveCSS('outline-style', 'none');
  await expect(editor).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.inline-source-cover')).toHaveCSS(
    'background-color',
    'rgb(240, 230, 210)',
  );
  await expect(editor).toHaveCSS('font-size', '17.5px');
  await expect(editor).toHaveCSS('font-weight', '700');
  await expect(editor).toHaveCSS('font-style', 'italic');
  await expect(editor).toHaveCSS('color', 'rgb(51, 76, 204)');
  await expect(editor).toHaveCSS('text-decoration-line', 'underline');
  await expect(page.getByLabel('underline', { exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const after = await inkBounds();
  for (const key of ['left', 'right', 'top', 'bottom'] as const)
    expect(Math.abs(after[key] - before[key])).toBeLessThanOrEqual(1);
  await page.getByLabel('Find text in document').click();
  await expect(page.getByLabel('Overlay text')).toHaveCount(0);
  await run.click();
  await editor.fill('Edited styled text');
  await page.getByLabel('Find text in document').click();
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await downloadPdf(await pending);
  const fonts = result.getPage(0).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const original = fonts.entries().find(([key]) => key.decodeText().startsWith('Helvetica'))![1];
  const alias = fonts
    .entries()
    .find(([key]) => key.decodeText().startsWith('PDFForgeOriginal'))![1];
  expect(alias.toString()).toBe(original.toString());
  expect(pageStreams(result)).toContain('40 550 Tm');
});

test('unembedded source fonts reuse their original PDF resource for new text', async ({ page }) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([500, 650]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  sheet.drawText('Arial source ABC', { x: 40, y: 550, font, size: 19 });
  await font.embed();
  pdf.context.lookup(font.ref, PDFDict).set(PDFName.of('BaseFont'), PDFName.of('ArialMT'));
  await open(page, pdf);
  await page.locator('.text-layer span').filter({ hasText: 'Arial source ABC' }).click();
  await expect(page.getByLabel('Font family', { exact: true })).toHaveValue('Arial');
  await page.getByLabel('Edit PDF text').fill('New text uses XYZ');
  await page.getByLabel('Find text in document').click();
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await downloadPdf(await pending);
  const fonts = result.getPage(0).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const reused = fonts
    .entries()
    .find(([key]) => key.decodeText().startsWith('PDFForgeOriginal'))![1];
  expect(result.context.lookup(reused, PDFDict).get(PDFName.of('BaseFont'))?.toString()).toBe(
    '/ArialMT',
  );
});

test('character spacing and horizontal scaling keep actual text and adjacent styles editable', async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([500, 650]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  sheet.pushOperators(pushGraphicsState(), setCharacterSpacing(2), setCharacterSqueeze(85));
  sheet.drawText('Spaced text', { x: 40, y: 550, font: regular, size: 16 });
  sheet.pushOperators(popGraphicsState());
  sheet.drawText('Plain', { x: 40, y: 480, font: regular, size: 18 });
  const nextX = 40 + regular.widthOfTextAtSize('Plain', 18);
  sheet.drawText('BOLD', { x: nextX, y: 480, font: bold, size: 18 });
  await open(page, pdf);
  const editor = page.getByLabel('Edit PDF text');
  await page.locator('.text-layer span').filter({ hasText: 'S p a c e d' }).click();
  await expect(editor).toHaveText('Spaced text');
  await expect(editor).toHaveCSS('letter-spacing', '2px');
  await page.keyboard.press('Escape');
  await page.locator('.text-layer span').filter({ hasText: 'Plain' }).click();
  await editor.fill('New');
  await page.getByLabel('Find text in document').click();
  await page.locator('.text-layer span').filter({ hasText: 'BOLD' }).click();
  await expect(editor).toHaveText('BOLD');
  await expect(editor).toHaveCSS('font-weight', '700');
});
