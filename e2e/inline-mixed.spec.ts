import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

test('merged source spans retain separate colors and partial underlines when clicked', async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([500, 650]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  sheet.drawText('RED', { x: 40, y: 550, font, size: 18, color: rgb(1, 0, 0) });
  const blueX = 40 + font.widthOfTextAtSize('RED', 18);
  sheet.drawText('BLUE', { x: blueX, y: 550, font, size: 18, color: rgb(0, 0, 1) });
  const text = 'plain word tail';
  sheet.drawText(text, { x: 40, y: 480, font, size: 18 });
  const wordX = 40 + font.widthOfTextAtSize('plain ', 18),
    wordWidth = font.widthOfTextAtSize('word', 18);
  sheet.drawLine({
    start: { x: wordX, y: 478 },
    end: { x: wordX + wordWidth, y: 478 },
    thickness: 0.7,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page
    .getByLabel('Open PDF', { exact: true })
    .setInputFiles({
      name: 'mixed.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await pdf.save()),
    });
  const canvas = page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas');
  await expect(canvas).toHaveJSProperty('width', 750);
  await expect(page.getByRole('article', { name: 'Page 1', exact: true })).toHaveAttribute('data-rendered', 'true');
  const bounds = (await canvas.boundingBox())!;
  const click = (x: number, y: number) => page.mouse.click(bounds.x + x, bounds.y + 650 - y - 8);
  const editor = page.getByLabel('Edit PDF text');
  await click(blueX + 8, 550);
  await expect(editor).toHaveText('BLUE');
  await expect(editor).toHaveCSS('color', 'rgb(0, 0, 255)');
  await editor.fill('NAVY');
  await page.getByLabel('Find text in document').click();
  await click(48, 550);
  await expect(editor).toHaveText('RED');
  await expect(editor).toHaveCSS('color', 'rgb(255, 0, 0)');
  await page.keyboard.press('Escape');
  await click(wordX + wordWidth / 2, 480);
  await expect(editor).toHaveText('word');
  await expect(editor).toHaveCSS('text-decoration-line', 'underline');
  await editor.fill('term');
  await page.getByLabel('Find text in document').fill('plain term tail');
  await expect(page.locator('.search-box')).toContainText('Go to page 1');
  await expect(page.getByLabel('Overlay text')).toHaveCount(2);
});
