import { expect, test, type Page } from '@playwright/test';
import { PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import { openAdvanced } from './advanced-helpers';
import { runPageCommand } from './workspace-helpers';

async function openOutline(page: Page) {
  const pdf = await PDFDocument.create(); for (let index = 0; index < 3; index += 1) pdf.addPage([400, 600]).drawText(`Page ${index + 1}`, { x: 40, y: 500 });
  const root = pdf.context.obj({ Type: 'Outlines', Count: 4 }), rootRef = pdf.context.register(root);
  const first = pdf.context.obj({ Title: PDFHexString.fromText('Chapter one'), Parent: rootRef, Dest: [pdf.getPage(0).ref, 'Fit'], Count: 1 }), firstRef = pdf.context.register(first);
  const child = pdf.context.obj({ Title: PDFHexString.fromText('Details'), Parent: firstRef, Dest: [pdf.getPage(1).ref, 'Fit'] }), childRef = pdf.context.register(child);
  const second = pdf.context.obj({ Title: PDFHexString.fromText('Chapter two'), Parent: rootRef, Dest: [pdf.getPage(2).ref, 'Fit'] }), secondRef = pdf.context.register(second);
  const broken = pdf.context.obj({ Title: PDFHexString.fromText('Unavailable section'), Parent: rootRef, Dest: PDFHexString.fromText('Missing') }), brokenRef = pdf.context.register(broken);
  first.set(PDFName.of('First'), childRef); first.set(PDFName.of('Last'), childRef); first.set(PDFName.of('Next'), secondRef);
  second.set(PDFName.of('Prev'), firstRef); second.set(PDFName.of('Next'), brokenRef); broken.set(PDFName.of('Prev'), secondRef);
  root.set(PDFName.of('First'), firstRef); root.set(PDFName.of('Last'), brokenRef); pdf.catalog.set(PDFName.of('Outlines'), rootRef);
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'outline.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('tab', { name: 'Outline', exact: true }).click();
}

test('commands have one canonical location and view controls stay above the document', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Tools', exact: true }).click();
  for (const name of ['Move page up', 'Move page down', 'Duplicate page', 'Delete page', 'Rotate page', 'Split current page']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Extract pages', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  for (const name of ['Duplicate page', 'Delete page', 'Rotate left', 'Rotate right']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(1);
  for (const name of ['Shapes & connectors', 'Equation editor', 'Object tools']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Shapes & connectors', exact: true })).toHaveCount(1); await expect(page.getByRole('button', { name: 'Equation editor', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Document view controls').getByLabel('Page number', { exact: true })).toHaveValue('1');
});

test('page previews preserve landscape and tall page proportions through rotation', async ({ page }) => {
  const pdf = await PDFDocument.create(); pdf.addPage([300, 600]); pdf.addPage([600, 300]);
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'ratios.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  const ratio = (number: number) => page.getByLabel(`Go to page ${number}`, { exact: true }).locator('.thumbnail-paper').evaluate((node) => node.clientWidth / node.clientHeight);
  await expect.poll(() => ratio(1)).toBeCloseTo(.5, 1); await expect.poll(() => ratio(2)).toBeCloseTo(2, 1);
  await page.getByLabel('Go to page 2', { exact: true }).click(); await runPageCommand(page, 'Rotate right');
  await expect.poll(() => ratio(2)).toBeCloseTo(.5, 1);
});

test('outline expands, filters, navigates, and follows reordered and duplicated pages', async ({ page }) => {
  await openOutline(page); const tree = page.getByRole('navigation', { name: 'PDF outline' });
  await expect(tree.getByRole('button', { name: 'Details 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse Chapter one', exact: true }).click(); await expect(tree.getByRole('button', { name: 'Details 2', exact: true })).not.toBeVisible();
  await page.getByLabel('Filter outline').fill('Details'); await expect(tree.getByRole('button', { name: 'Details 2', exact: true })).toBeVisible();
  await expect(tree.getByRole('button', { name: /Chapter two/ })).toHaveCount(0); await page.getByLabel('Filter outline').fill('');
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  await tree.getByRole('button', { name: 'Chapter two 3', exact: true }).click(); await runPageCommand(page, 'Move page up');
  await expect(tree.getByRole('button', { name: 'Chapter two 2', exact: true })).toHaveAttribute('aria-current', 'location');
  await runPageCommand(page, 'Duplicate page'); await tree.getByRole('button', { name: 'Chapter two 3', exact: true }).click();
  await page.getByRole('tab', { name: 'Outline', exact: true }).press('ArrowLeft'); await expect(page.getByRole('tab', { name: 'Thumbnails', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('outline handles broken destinations and switching to a document with no bookmarks', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await openOutline(page); await expect(page.getByRole('button', { name: 'Unavailable section —', exact: true })).toBeDisabled();
  const empty = await PDFDocument.create(); empty.addPage([300, 400]); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'plain.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await empty.save()) });
  await expect(page.getByText('No bookmarks in this PDF', { exact: true })).toBeVisible(); expect(errors).toEqual([]);
});

test('panel resizing supports keyboard bounds and automatic fit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await openAdvanced(page); await page.getByRole('button', { name: 'Fit width', exact: true }).click();
  await expect.poll(async () => Number(await page.getByLabel('Zoom percent').inputValue())).toBeGreaterThan(100);
  const before = Number(await page.getByLabel('Zoom percent').inputValue());
  const handle = page.getByRole('separator', { name: 'Resize navigation panel', exact: true });
  await handle.press('ArrowRight'); await expect(handle).toHaveAttribute('aria-valuenow', '230');
  await expect.poll(async () => Number(await page.getByLabel('Zoom percent').inputValue())).toBeLessThan(before);
  await handle.press('Home'); await expect(handle).toHaveAttribute('aria-valuenow', '220');
  const bounds = (await handle.boundingBox())!; await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 40); await page.mouse.down(); await page.mouse.move(bounds.x + 240, bounds.y + 40); await page.mouse.up(); await expect(handle).toHaveAttribute('aria-valuenow', '340'); await handle.press('Home');
  const properties = page.getByRole('separator', { name: 'Resize properties panel', exact: true });
  await properties.press('ArrowLeft'); await expect(properties).toHaveAttribute('aria-valuenow', '310');
  await properties.press('Home'); await expect(properties).toHaveAttribute('aria-valuenow', '300');
});

test('inspector filters by text and page, reveals objects, and preserves editing and Undo', async ({ page }) => {
  await openAdvanced(page, 2); await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click(); await page.getByLabel('Overlay text', { exact: true }).fill('First object');
  await page.getByLabel('Go to page 2', { exact: true }).click(); await page.getByRole('button', { name: 'Add text overlay', exact: true }).click(); await page.getByLabel('Overlay text', { exact: true }).last().fill('Second object');
  await page.getByLabel('Filter objects').fill('First'); await expect(page.getByLabel('Overlay text', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Home', exact: true }).click(); await page.getByRole('button', { name: 'Select text', exact: true }).click();
  await page.locator('.object-card-heading button').click(); await expect(page.getByLabel('Go to page 1', { exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Select text', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Filter objects').fill(''); await page.getByLabel('Object page scope').selectOption('current'); await expect(page.getByLabel('Overlay text', { exact: true })).toHaveCount(1);
  await page.getByLabel('Overlay text', { exact: true }).fill('Changed first'); await page.getByLabel('Undo', { exact: true }).click(); await expect(page.getByLabel('Overlay text', { exact: true })).toHaveValue('First object');
  await page.getByRole('button', { name: 'Document', exact: true }).click(); await expect(page.getByText('advanced.pdf', { exact: true }).last()).toBeVisible();
});
