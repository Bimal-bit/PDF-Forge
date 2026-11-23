import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

async function image(page: Page, text = 'INVOICE TOTAL 12345') {
  return Buffer.from(await page.evaluate((text) => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 400;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white'; context.fillRect(0, 0, 1200, 400);
    context.font = 'bold 54px Arial'; context.fillStyle = 'black'; context.fillText(text, 60, 180);
    return canvas.toDataURL('image/png').split(',')[1];
  }, text), 'base64');
}

test.describe('phone workspace', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); });

  test('landing navigation, FAQs, tool entry points and typography fit small phones', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.getByLabel('Toggle navigation').tap();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Tools', exact: true }).tap();
    await expect(page.getByLabel('Toggle navigation')).toHaveAttribute('aria-expanded', 'false');
    await page.getByText('Can I edit a picture of a document?', { exact: true }).tap();
    await expect(page.locator('details[open]')).toContainText('Editable text boxes');
    await page.getByText('Will the original font be preserved?', { exact: true }).tap();
    await expect(page.locator('details').filter({ hasText: 'Will the original font be preserved?' })).toContainText('approximate font match');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const fonts = await page.locator('.landing h1, .landing h2, .landing summary, .landing button').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fontFamily));
    expect(fonts.every((family) => family.startsWith('Inter'))).toBe(true);
    const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Image to editable text', exact: false }).tap();
    expect((await chooser).isMultiple()).toBe(false);
  });

  test('blank document fits the phone, supports editing, panel switching, undo and export', async ({ page }) => {
    await page.getByRole('button', { name: 'Start a blank PDF', exact: false }).tap();
    const paper = page.getByRole('article', { name: 'Page 1', exact: true });
    await expect(paper.locator('canvas')).toBeVisible();
    await expect.poll(async () => (await paper.boundingBox())!.width).toBeLessThan(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.getByRole('button', { name: 'Add text', exact: true }).tap();
    const mobile = page.getByLabel('Mobile workspace');
    await mobile.getByRole('button', { name: 'Inspector', exact: true }).tap();
    await page.getByLabel('Overlay text', { exact: true }).fill('Edited on a phone');
    await page.getByRole('button', { name: 'Hide properties panel', exact: true }).tap();
    await expect(page.getByLabel('Overlay text', { exact: true })).toHaveCount(0);
    await mobile.getByRole('button', { name: 'Pages', exact: true }).tap();
    await expect(page.getByRole('complementary', { name: 'Document navigation', exact: true })).toBeVisible();
    await mobile.getByRole('button', { name: 'Inspector', exact: true }).tap();
    await expect(page.getByRole('complementary', { name: 'Document navigation', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Hide properties panel', exact: true }).tap();
    await page.getByLabel('Undo', { exact: true }).tap();
    await expect(page.locator('.text-object')).toContainText('Text overlay');
    await page.getByLabel('Redo', { exact: true }).tap();
    const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).tap();
    const pdf = await PDFDocument.load(await readFile((await (await pending).path())!));
    expect(pdf.getPageCount()).toBe(1);
    await mobile.getByRole('button', { name: 'Scan text', exact: true }).tap();
    await expect(page.getByRole('dialog', { name: 'Offline OCR', exact: true })).toBeVisible();
    await expect(page.getByLabel('OCR result', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recognize document', exact: true })).toBeInViewport();
  });

  test('image OCR can be reviewed, corrected, edited, exported, recovered and undone locally', async ({ page }) => {
    test.setTimeout(120000);
    const external: string[] = [];
    page.on('request', (request) => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5173/')) external.push(request.url()); });
    await page.getByLabel('Open image for OCR', { exact: true }).setInputFiles({ name: 'invoice.png', mimeType: 'image/png', buffer: await image(page) });
    const dialog = page.getByRole('dialog', { name: 'Offline OCR', exact: true });
    await expect(dialog).toBeVisible();
    await page.getByLabel('OCR result', { exact: true }).selectOption('editable');
    await page.getByLabel('OCR pages', { exact: true }).selectOption('current');
    await page.getByRole('button', { name: 'Recognize document', exact: true }).tap();
    await expect(page.getByLabel('OCR line 1', { exact: true })).toHaveValue(/INVOICE/, { timeout: 100000 });
    await page.getByLabel('OCR line 1', { exact: true }).fill('INVOICE TOTAL 54321');
    const textDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download text', exact: true }).tap();
    expect(await readFile((await (await textDownload).path())!, 'utf8')).toContain('54321');
    await page.getByRole('button', { name: 'Apply editable text', exact: true }).tap();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.text-object')).toContainText('54321');
    await page.getByRole('button', { name: 'Edit text: INVOICE TOTAL 54321', exact: true }).tap();
    await page.getByLabel('Edit PDF text', { exact: true }).fill('INVOICE TOTAL 99999');
    await page.getByLabel('Mobile workspace').getByRole('button', { name: 'Find text', exact: true }).tap();
    await page.getByLabel('Find text in document', { exact: true }).fill('99999');
    await expect(page.getByText('1 matching page', { exact: false })).toBeVisible();
    const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).tap();
    expect((await pending).suggestedFilename()).toBe('invoice-edited.pdf');
    await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 });
    await page.reload();
    await expect(page.locator('.text-object')).toContainText('99999');
    expect(external).toEqual([]);
  });

  test('source text edits by touch and every ribbon stays reachable through portrait and landscape', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]).drawText('Tap to edit this line', { x: 40, y: 500, size: 18 });
    await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'touch.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
    await page.getByRole('button', { name: 'Edit text: Tap to edit this line', exact: true }).tap();
    await page.getByLabel('Edit PDF text', { exact: true }).fill('Changed with touch');
    await page.getByLabel('Mobile workspace').getByRole('button', { name: 'Find text', exact: true }).tap();
    await expect(page.locator('.text-object')).toContainText('Changed with touch');
    for (const size of [{ width: 320, height: 740 }, { width: 600, height: 900 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      await expect(page.getByRole('button', { name: 'Toggle theme', exact: true })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeInViewport();
      for (const tab of ['Home', 'Insert', 'Layout', 'Review', 'View', 'Tools']) {
        await page.getByRole('navigation', { name: 'Ribbon tabs' }).getByRole('button', { name: tab, exact: true }).tap();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect((await page.getByLabel('Document canvas', { exact: true }).boundingBox())!.height).toBeGreaterThan(60);
      }
      await expect(page.getByLabel('Mobile workspace')).toBeVisible();
    }
    await page.getByRole('button', { name: 'Show ribbon tools', exact: true }).tap();
    await expect(page.locator('.tool-strip')).toBeVisible();
    await page.getByRole('button', { name: 'Hide ribbon tools', exact: true }).tap();
    await expect(page.locator('.tool-strip')).toBeHidden();
    for (const size of [{ width: 390, height: 844 }, { width: 600, height: 900 }, { width: 320, height: 740 }, { width: 844, height: 390 }]) await page.setViewportSize(size);
    await expect(page.getByRole('article', { name: 'Page 1', exact: true })).toHaveAttribute('data-rendered', 'true');
    expect(errors).toEqual([]);
  });

  test('View workspace toggles control the same phone drawers without document history', async ({ page }) => {
    await page.getByRole('button', { name: 'Start a blank PDF', exact: false }).tap();
    await page.getByRole('navigation', { name: 'Ribbon tabs' }).getByRole('button', { name: 'View', exact: true }).tap();
    const history = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().history.length);
    await page.getByRole('button', { name: 'Navigation', exact: true }).tap();
    await expect(page.getByRole('complementary', { name: 'Document navigation', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Properties', exact: true }).tap();
    await expect(page.getByRole('complementary', { name: 'Document navigation', exact: true })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Properties', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Hide properties panel', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Properties', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Reading focus', exact: true }).tap();
    await page.getByLabel('Mobile workspace').getByRole('button', { name: 'Pages', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Exit reading focus (Esc)', exact: true })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Document navigation', exact: true })).toBeVisible();
    expect(await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().history.length)).toBe(history);
  });
});

test('closing OCR cancels a running scan and invalid images preserve the workspace', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open image for OCR', { exact: true }).setInputFiles({ name: 'scan.png', mimeType: 'image/png', buffer: await image(page) });
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await page.getByRole('button', { name: 'Close Offline OCR', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Offline OCR', exact: true })).toHaveCount(0);
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toContainText('could not be decoded');
  await expect(page.locator('.document-name')).toHaveText('scan.pdf');
  await expect(page.locator('.text-object')).toHaveCount(0);
});
