import { runPageCommand } from './workspace-helpers';
import { expect, test, type Page } from '@playwright/test';
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib';
import { downloadPdf, openAdvanced, pageStreams } from './advanced-helpers';

async function view(page: Page) { await page.getByRole('button', { name: 'View', exact: true }).click(); }
async function activePage(page: Page) { return page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().selectedPage); }
async function zoom(page: Page) { return page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().zoom); }
async function fits(page: Page, mode: 'width' | 'page') {
  return page.locator('.canvas').evaluate((canvas, fitMode) => {
    const sheet = canvas.querySelector<HTMLElement>('.pdf-page[data-page-number="' + (document.querySelector<HTMLInputElement>('[aria-label="Page number"]')?.value ?? 1) + '"]')!;
    const size = sheet.getBoundingClientRect(), style = getComputedStyle(canvas);
    const width = canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = canvas.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 20;
    return Math.abs(size.width - width) < 2 || (fitMode === 'page' && size.width <= width + 1 && size.height <= height + 1 && (Math.abs(size.height - height) < 2));
  }, mode);
}

test('custom zoom commits complete numeric drafts, bounds values, and resets automatic fit', async ({ page }) => {
  await openAdvanced(page); await view(page);
  const input = page.getByLabel('Zoom percent', { exact: true });
  await input.fill('125.5'); expect(await zoom(page)).toBe(100);
  await input.press('Enter'); await expect.poll(() => zoom(page)).toBe(125.5);
  await input.fill('2'); await input.press('Enter'); await expect(input).toHaveValue('10');
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
  await input.fill('1000'); await input.press('Enter'); await expect(input).toHaveValue('500');
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
  await input.fill(''); await input.press('Enter'); await expect(input).toHaveValue('500');
  await input.fill('33'); await input.press('Escape'); await expect(input).toHaveValue('500');
  await page.getByRole('button', { name: '100%', exact: true }).click();
  await expect.poll(() => zoom(page)).toBe(100);
  await page.getByRole('button', { name: 'Fit page', exact: true }).click();
  await expect.poll(() => fits(page, 'page')).toBe(true);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fit page', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('automatic fit follows panel sizes, window resizing, and the current page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAdvanced(page, 2); await view(page);
  await page.getByRole('button', { name: 'Fit width', exact: true }).click();
  await expect.poll(() => fits(page, 'width')).toBe(true);
  const before = await zoom(page);
  await page.getByRole('button', { name: 'Properties', exact: true }).click();
  await expect.poll(() => zoom(page)).toBeGreaterThan(before);
  await expect.poll(() => fits(page, 'width')).toBe(true);
  await page.setViewportSize({ width: 900, height: 720 });
  await expect.poll(() => fits(page, 'width')).toBe(true);
  await page.getByRole('button', { name: 'Fit page', exact: true }).click();
  await expect.poll(() => fits(page, 'page')).toBe(true);
  await page.getByRole('button', { name: 'Last page', exact: true }).click();
  await expect.poll(() => activePage(page)).toBe(2);
  await expect.poll(() => page.getByRole('article', { name: 'Page 2', exact: true }).evaluate((sheet) => { const rect = sheet.getBoundingClientRect(), canvas = sheet.closest('.canvas')!.getBoundingClientRect(); return rect.top >= canvas.top && rect.bottom <= canvas.bottom; })).toBe(true);
});

test('fit respects cropped native rotation and reordered duplicated display pages', async ({ page }) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([500, 650]); pdf.addPage([900, 700]).setCropBox(100, 200, 600, 300);
  pdf.getPage(1).setRotation(degrees(90));
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'crop-view.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas')).toHaveJSProperty('width', 750);
  await page.getByLabel('Go to page 2', { exact: true }).click();
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await runPageCommand(page, 'Move page up');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await runPageCommand(page, 'Duplicate page');
  await view(page); await page.getByRole('button', { name: 'Fit page', exact: true }).click();
  await expect.poll(() => fits(page, 'page')).toBe(true);
  await expect(page.getByLabel('Page number', { exact: true })).toHaveValue('2');
  await expect(page.getByRole('group', { name: 'Page navigation' })).toContainText('of 3');
  await expect.poll(() => page.getByRole('article', { name: 'Page 2', exact: true }).evaluate((sheet) => sheet.clientHeight / sheet.clientWidth)).toBeCloseTo(2, 1);
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await runPageCommand(page, 'Rotate right');
  await view(page); await expect.poll(() => fits(page, 'page')).toBe(true);
  await expect.poll(() => page.getByRole('article', { name: 'Page 2', exact: true }).evaluate((sheet) => sheet.clientWidth / sheet.clientHeight)).toBeCloseTo(2, 1);
});

test('page navigation validates drafts, handles boundaries, and reveals an already active page', async ({ page }) => {
  await openAdvanced(page, 4); await view(page);
  await expect(page.getByRole('button', { name: 'First page', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByLabel('Page number', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'Last page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  const input = page.getByLabel('Page number', { exact: true });
  await input.fill('2'); await input.press('Enter'); await expect.poll(() => activePage(page)).toBe(2);
  await page.locator('.canvas').evaluate((canvas) => { canvas.scrollTop += 180; });
  await input.fill('2'); await input.press('Enter');
  await expect.poll(() => page.getByRole('article', { name: 'Page 2', exact: true }).evaluate((sheet) => sheet.getBoundingClientRect().top - sheet.closest('.canvas')!.getBoundingClientRect().top)).toBeCloseTo(24, 0);
  await input.fill('999'); await input.press('Tab'); await expect(input).toHaveValue('4');
  await input.fill('-10'); await input.press('Enter'); await expect(input).toHaveValue('1');
  await page.getByRole('button', { name: 'Last page', exact: true }).click();
  await page.getByRole('button', { name: 'First page', exact: true }).click();
  await expect(input).toHaveValue('1');
});

test('search navigates every matching display page in both directions and retains a hidden query', async ({ page }) => {
  await openAdvanced(page, 3, 'Needle'); await view(page);
  const input = page.getByLabel('Find text in document', { exact: true });
  await input.fill('Needle'); await expect(page.locator('.search-box')).toContainText('3 matches');
  await input.press('Enter'); await expect.poll(() => activePage(page)).toBe(2);
  await page.getByLabel('Next matching page', { exact: true }).click(); await expect.poll(() => activePage(page)).toBe(3);
  await page.getByLabel('Next matching page', { exact: true }).click(); await expect.poll(() => activePage(page)).toBe(1);
  await input.press('Shift+Enter'); await expect.poll(() => activePage(page)).toBe(3);
  await page.getByRole('button', { name: 'Document search', exact: true }).click(); await expect(input).not.toBeVisible();
  await page.getByRole('button', { name: 'Document search', exact: true }).click(); await expect(input).toHaveValue('Needle');
  await page.getByLabel('Clear search', { exact: true }).click(); await expect(input).toHaveValue('');
  await expect(page.getByLabel('Next matching page', { exact: true })).not.toBeVisible();
});

test('reading focus restores chosen panel visibility with Escape and an exit button', async ({ page }) => {
  await openAdvanced(page); await view(page);
  await page.getByRole('button', { name: 'Navigation', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Document navigation', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Reading focus', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Properties', exact: true })).not.toBeVisible();
  await expect(page.getByLabel('Find text in document')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Properties', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Document navigation', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Reading focus', exact: true }).click();
  await page.getByRole('button', { name: 'Exit reading focus (Esc)', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Document navigation', exact: true })).toBeVisible();
});

test('Home Find and the keyboard shortcut reveal and focus hidden document search', async ({ page }) => {
  await openAdvanced(page, 1, 'Find this'); await view(page);
  await page.getByRole('button', { name: 'Document search', exact: true }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(page.getByLabel('Find text in document', { exact: true })).toBeFocused();
  await view(page); await page.getByRole('button', { name: 'Reading focus', exact: true }).click();
  await page.keyboard.press('Control+f');
  await expect(page.getByLabel('Find text in document', { exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Reading focus', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Find text in document', { exact: true }).fill('Find');
  await expect(page.locator('.search-box')).toContainText('1 match');
});

test('night reading inverts the screen while export retains source colors and text', async ({ page }) => {
  const pdf = await PDFDocument.create(); const sheet = pdf.addPage([500, 650]);
  sheet.drawText('Night source', { x: 40, y: 550, size: 18, font: await pdf.embedFont(StandardFonts.Helvetica) });
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'night.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await view(page); await page.getByRole('button', { name: 'Night reading', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Page 1', exact: true })).toHaveCSS('filter', 'invert(1) hue-rotate(180deg)');
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const exported = await downloadPdf(await pending);
  expect(pageStreams(exported)).toContain('0 0 0 rg'); expect(pageStreams(exported)).toContain('4E6967687420736F75726365');
  await page.getByRole('button', { name: 'Night reading', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Page 1', exact: true })).toHaveCSS('filter', 'none');
});

test('offscreen page geometry remains accurate without allocating main viewer canvases', async ({ page }) => {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 12; index += 1) pdf.addPage([300 + index * 10, 450 + index * 20]);
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'geometry.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  const last = page.getByRole('article', { name: 'Page 12', exact: true });
  await expect(last).toHaveCSS('height', '670px'); await expect(last).toHaveCSS('width', '410px');
  await expect(last.locator('canvas')).toHaveJSProperty('width', 300);
  await view(page); await page.getByRole('button', { name: 'Last page', exact: true }).click();
  await expect(last.locator('canvas')).toHaveJSProperty('width', 615);
  await expect(page.getByLabel('Go to page 12', { exact: true })).toHaveAttribute('aria-current', 'page');
});

test('mixed page sizes keep narrow pages centered and oversized pages horizontally reachable', async ({ page }) => {
  const pdf = await PDFDocument.create(); pdf.addPage([500, 650]); pdf.addPage([2400, 400]); pdf.addPage([400, 600]);
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'mixed-view.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByRole('article', { name: 'Page 2', exact: true })).toHaveCSS('width', '2400px');
  const visible = (number: number) => page.getByRole('article', { name: `Page ${number}`, exact: true }).evaluate((sheet) => { const rect = sheet.getBoundingClientRect(), canvas = sheet.closest('.canvas')!.getBoundingClientRect(); return rect.left >= canvas.left && rect.right <= canvas.right; });
  await expect.poll(() => visible(1)).toBe(true);
  await view(page); await page.getByRole('button', { name: 'Last page', exact: true }).click();
  await expect.poll(() => visible(3)).toBe(true);
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await page.locator('.canvas').evaluate((canvas) => { canvas.scrollLeft = 0; });
  await expect.poll(() => page.getByRole('article', { name: 'Page 2', exact: true }).evaluate((sheet) => sheet.getBoundingClientRect().left - sheet.closest('.canvas')!.getBoundingClientRect().left)).toBeGreaterThanOrEqual(0);
});
