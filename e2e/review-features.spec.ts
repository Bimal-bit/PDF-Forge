import { runPageCommand } from './workspace-helpers';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString, degrees } from 'pdf-lib';
import { downloadPdf, openAdvanced, pageStreams } from './advanced-helpers';

async function openReview(page: Page, count = 1) { await openAdvanced(page, count); await page.getByRole('button', { name: 'Review', exact: true }).click(); }
async function objects(page: Page) { return page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects); }
async function editMark(page: Page) { await page.locator('.review-toolbar').getByRole('button', { name: 'Edit mark', exact: true }).click(); return page.getByRole('dialog', { name: 'Edit review mark', exact: true }); }
async function manager(page: Page) { await page.getByRole('button', { name: 'Comments & marks', exact: true }).click(); return page.getByRole('dialog', { name: 'Comments & marks', exact: true }); }
async function seedChanges(page: Page) {
  await page.evaluate(async () => {
    const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState(); state.setReviewOptions({ trackChanges: false });
    for (const [index, text] of ['First original', 'Second original', 'Other original'].entries()) state.addObject({ id: `text-${index}`, type: 'text', page: index === 2 ? 2 : 1, x: 40, y: 100 + index * 60, width: 220, text, fontSize: 12, color: '#000000' });
    state.setReviewOptions({ trackChanges: true, changeAuthor: 'Ava' }); state.updateTextObject('text-0', 'First revision'); state.updateTextObject('text-1', 'Second revision');
    state.setReviewOptions({ changeAuthor: 'Ben' }); state.updateTextObject('text-2', 'Other revision');
  });
}

test('mark editing saves geometry, Unicode comments, color, and status atomically through export and recovery', async ({ page }) => {
  await openReview(page); await page.getByLabel('New highlight color').fill('#0088cc'); await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  const original = await objects(page), dialog = await editMark(page);
  await dialog.getByLabel('Review comment', { exact: true }).fill('Résumé & Ω review'); await dialog.getByLabel('Review author', { exact: true }).fill('Zoë Ω'); await dialog.getByLabel('Comment resolved').check();
  await dialog.getByLabel('Review mark x').fill('50'); await dialog.getByLabel('Review mark y').fill('100');
  const width = dialog.getByLabel('Review mark width'); await width.fill(''); await width.pressSequentially('25'); await width.press('Tab'); await expect(width).toHaveValue('25');
  await dialog.getByLabel('Review mark height').fill('18'); expect(await objects(page)).toEqual(original);
  const history = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().history.length);
  await dialog.getByRole('button', { name: 'Save review mark', exact: true }).click();
  expect(await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().history.length)).toBe(history + 1);
  await expect(page.locator('.annotation-highlight rect')).toHaveAttribute('fill', '#0088cc'); await expect(page.locator('.annotation-highlight rect')).toHaveAttribute('fill-opacity', '0.35');
  await expect(page.locator('.annotation-highlight')).toHaveCSS('width', '25px'); await expect(page.locator('.review-context-bar')).toContainText('0 open');
  await page.getByLabel('Undo', { exact: true }).click(); expect(await objects(page)).toEqual(original); await page.getByLabel('Redo', { exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); const pdf = await downloadPdf(await pending), annotation = pdf.getPage(0).node.Annots()!.lookup(0, PDFDict);
  expect(annotation.lookup(PDFName.of('Contents'), PDFHexString).decodeText()).toBe('Résumé & Ω review'); expect(annotation.lookup(PDFName.of('T'), PDFHexString).decodeText()).toBe('Zoë Ω'); expect(annotation.lookup(PDFName.of('State'), PDFString).decodeText()).toBe('Completed');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 }); await page.reload(); await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByLabel('Review mark', { exact: true }).selectOption({ index: 1 }); const recovered = await editMark(page); await expect(recovered.getByLabel('Review comment', { exact: true })).toHaveValue('Résumé & Ω review'); await expect(recovered.getByLabel('Comment resolved')).toBeChecked();
});

test('the mark manager filters by author, page, kind and status, resolves/reopens, navigates and deletes', async ({ page }) => {
  await openReview(page, 2); await page.getByRole('button', { name: 'Add comment', exact: true }).click(); await page.getByLabel('Annotation comment').fill('Needs correction'); await page.getByLabel('Annotation author').fill('Isha');
  await page.getByRole('button', { name: 'Highlight', exact: true }).click(); await page.getByLabel('Annotation comment').last().fill('Ready to print'); await page.getByLabel('Annotation author').last().fill('Ben');
  await page.getByLabel('Go to page 2', { exact: true }).click(); await page.getByRole('button', { name: 'Add comment', exact: true }).click(); await page.getByLabel('Annotation comment').last().fill('Second page'); await page.getByLabel('Annotation author').last().fill('Isha');
  let dialog = await manager(page); const list = dialog.getByRole('list', { name: 'Review marks', exact: true }); await expect(list.locator('li')).toHaveCount(3);
  await dialog.getByLabel('Search review marks').fill('isha'); await expect(list.locator('li')).toHaveCount(2); await dialog.getByLabel('Review page filter').selectOption('current'); await expect(list.locator('li')).toHaveCount(1);
  await dialog.getByLabel('Review page filter').selectOption('all'); await dialog.getByLabel('Review mark type').selectOption('note'); await dialog.getByLabel('Review comment status').selectOption('open');
  await list.getByRole('button', { name: 'Resolve comment', exact: true }).first().click(); await expect(list.locator('li')).toHaveCount(1);
  await dialog.getByLabel('Review comment status').selectOption('resolved'); await expect(list).toContainText('Needs correction'); await list.getByRole('button', { name: 'Reopen comment', exact: true }).click(); await expect(list.locator('li')).toHaveCount(0);
  await dialog.getByLabel('Review comment status').selectOption('all'); await list.getByRole('button', { name: 'Go to mark', exact: true }).first().click(); await expect(dialog).not.toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().selectedPage)).toBe(1); await expect(page.locator('.annotation-note.selected-review-mark')).toBeInViewport();
  dialog = await manager(page); await dialog.getByRole('button', { name: 'Delete mark', exact: true }).first().click(); await dialog.getByLabel('Close Comments & marks').click(); expect(await objects(page)).toHaveLength(2); await page.getByLabel('Undo', { exact: true }).click(); expect(await objects(page)).toHaveLength(3);
});

test('stamps and signed measurements keep their geometry through zoom and PDF export', async ({ page }) => {
  await openReview(page); await page.getByLabel('New review stamp').selectOption('DRAFT'); await page.getByRole('button', { name: 'Draft stamp', exact: true }).click();
  let dialog = await editMark(page); await dialog.getByLabel('Review stamp label').selectOption('CONFIDENTIAL'); await dialog.getByRole('button', { name: 'Save review mark', exact: true }).click(); await expect(page.locator('.annotation-stamp text')).toHaveText('CONFIDENTIAL');
  await page.getByRole('button', { name: 'Measure', exact: true }).click(); dialog = await editMark(page);
  for (const [label, value] of [['x', '200'], ['y', '300'], ['width', '-100'], ['height', '-60']]) await dialog.getByLabel(`Review mark ${label}`, { exact: true }).fill(value);
  await dialog.getByLabel('Review measure units').selectOption('cm'); await expect(dialog.getByRole('status')).toContainText('4.11 cm'); await dialog.getByRole('button', { name: 'Save review mark', exact: true }).click();
  await expect(page.locator('.annotation-measure line')).toHaveAttribute('x1', '100'); await expect(page.locator('.annotation-measure line')).toHaveAttribute('x2', '0'); await expect(page.locator('.annotation-measure line')).toHaveAttribute('y1', '16'); await expect(page.locator('.annotation-measure line')).toHaveAttribute('y2', '76');
  await page.getByRole('button', { name: 'View', exact: true }).click(); for (let index = 0; index < 5; index += 1) await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); await page.getByRole('button', { name: 'Review', exact: true }).click(); await expect(page.locator('.annotation-measure')).toHaveCSS('width', '150px'); await expect(page.locator('.annotation-stamp')).toHaveCSS('height', '48px');
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); const pdf = await downloadPdf(await pending), marks = pdf.getPage(0).node.Annots()!;
  expect(marks.lookup(0, PDFDict).get(PDFName.of('Name'))?.toString()).toBe('/CONFIDENTIAL'); expect(marks.lookup(1, PDFDict).lookup(PDFName.of('L'), PDFArray).asArray().map(String)).toEqual(['200', '300', '100', '240']);
});

test('Review placement follows native crop rotation and reordered pages, and XML export omits deleted-page marks', async ({ page }) => {
  const source = await PDFDocument.create(); const sheet = source.addPage([650, 900]); sheet.setCropBox(120, 200, 400, 600); sheet.setRotation(degrees(90)); source.addPage([500, 650]);
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'rotated.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await source.save()) });
  await page.getByRole('button', { name: 'Layout', exact: true }).click(); await runPageCommand(page, 'Move page down'); await page.getByRole('button', { name: 'Review', exact: true }).click();
  for (const name of ['Highlight', 'Add comment', 'Approved stamp', 'Measure']) await page.getByRole('button', { name, exact: true }).click();
  for (const object of await objects(page)) expect(object.page).toBe(1);
  const canvas = page.getByRole('article', { name: 'Page 2', exact: true }).locator('canvas'); await expect(canvas).toHaveJSProperty('width', 900); const bounds = (await canvas.boundingBox())!;
  for (const mark of await page.locator('.review-mark').all()) { const box = (await mark.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(bounds.x); expect(box.y).toBeGreaterThanOrEqual(bounds.y); expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1); expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1); }
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export PDFForge XFDF', exact: true }).click(); const xml = await readFile((await (await pending).path())!, 'utf8'); expect(xml.match(/page="1"/g)).toHaveLength(4);
  await page.getByRole('button', { name: 'Layout', exact: true }).click(); await runPageCommand(page, 'Delete page'); await page.getByRole('button', { name: 'Review', exact: true }).click(); await expect(page.getByRole('button', { name: 'Export PDFForge XFDF', exact: true })).toBeDisabled(); const dialog = await manager(page); await expect(dialog.getByRole('status')).toContainText('0 matching');
});

test('filtered bulk acceptance is one Undo step and retains unrelated pending changes', async ({ page }) => {
  await openReview(page, 2); await seedChanges(page); await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tracked changes', exact: true }); await dialog.getByLabel('Search tracked changes').fill('Ava'); await expect(dialog.getByRole('list', { name: 'Text changes', exact: true }).locator('li')).toHaveCount(2);
  const history = await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().history.length);
  await dialog.getByRole('button', { name: 'Accept visible changes', exact: true }).click(); await expect(dialog.getByRole('button', { name: 'Accept visible changes', exact: true })).toBeDisabled();
  expect(await page.evaluate(async () => { const s = (await import('/src/store/useAppStore.ts')).useAppStore.getState(); return { count: s.history.length, statuses: s.textChanges.map((c) => c.status) }; })).toEqual({ count: history + 1, statuses: ['accepted', 'accepted', 'pending'] });
  await dialog.getByLabel('Change filter').selectOption('accepted'); await expect(dialog.getByRole('list', { name: 'Text changes', exact: true }).locator('li')).toHaveCount(2); await dialog.getByLabel('Close Tracked changes').click();
  await page.getByLabel('Undo', { exact: true }).click(); expect(await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().textChanges.map((c) => c.status))).toEqual(['pending', 'pending', 'pending']); await page.getByLabel('Redo', { exact: true }).click();
});

test('current-page bulk rejection restores text and persists the remaining review through recovery and export', async ({ page }) => {
  await openReview(page, 2); await seedChanges(page); await page.getByRole('button', { name: 'Tracked changes', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Tracked changes', exact: true });
  await dialog.getByLabel('Tracked change pages').selectOption('current'); await expect(dialog.getByRole('status')).toContainText('2 pending decisions'); await dialog.getByRole('button', { name: 'Reject visible changes', exact: true }).click(); await dialog.getByLabel('Close Tracked changes').click();
  expect((await objects(page)).map((object) => object.type === 'text' ? object.text : '')).toEqual(['First original', 'Second original', 'Other revision']);
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 }); await page.reload(); await page.getByRole('button', { name: 'Review', exact: true }).click(); await page.getByRole('button', { name: 'Tracked changes', exact: true }).click();
  await expect(dialog.getByRole('list', { name: 'Text changes', exact: true })).toContainText('Other revision'); await dialog.getByRole('button', { name: 'Go to changed text', exact: true }).click(); await expect(dialog).not.toBeVisible();
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click(); const pdf = await downloadPdf(await pending); expect(pageStreams(pdf, 0)).toContain(Buffer.from('First original').toString('hex').toUpperCase()); expect(pageStreams(pdf, 1)).toContain(Buffer.from('Other revision').toString('hex').toUpperCase());
});

test('annotation XML retains statuses and literal text, imports copies independently, and rejects invalid status', async ({ page }) => {
  await openReview(page); const file = { name: 'resolved.xfdf', mimeType: 'text/xml', buffer: Buffer.from('<xfdf><annots><highlight id="same" page="1" x="40" y="50" width="140" height="20" color="#08c" author="A &amp; B" resolved="true">Literal &amp;lt;tag&amp;gt;</highlight></annots></xfdf>') };
  await page.getByLabel('Import PDFForge XFDF').setInputFiles(file); const dialog = await editMark(page); await expect(dialog.getByLabel('Review highlight color')).toHaveValue('#0088cc'); await expect(dialog.getByLabel('Comment resolved')).toBeChecked(); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export PDFForge XFDF', exact: true }).click(); const xml = await readFile((await (await pending).path())!, 'utf8'); expect(xml).toContain('resolved="true"'); expect(xml).toContain('Literal &amp;lt;tag&amp;gt;');
  await page.getByLabel('Import PDFForge XFDF').setInputFiles(file); const copied = await objects(page); expect(copied).toHaveLength(2); expect(copied[0].id).not.toBe(copied[1].id); await page.getByLabel('Undo', { exact: true }).click(); expect(await objects(page)).toHaveLength(1);
  await page.getByLabel('Import PDFForge XFDF').setInputFiles({ ...file, buffer: Buffer.from(xml.replace('resolved="true"', 'resolved="yes"')) }); await expect(page.getByRole('alert')).toContainText('status'); expect(await objects(page)).toHaveLength(1);
});

test('mark editing cancels drafts, rejects stale or out-of-crop saves, and keeps narrow dialogs usable', async ({ page }) => {
  await openReview(page); await page.getByRole('button', { name: 'Add comment', exact: true }).click(); const original = await objects(page); let dialog = await editMark(page); await dialog.getByLabel('Review comment', { exact: true }).fill('Cancelled'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(await objects(page)).toEqual(original);
  dialog = await editMark(page); await dialog.getByLabel('Review mark x').fill('490'); await dialog.getByRole('button', { name: 'Save review mark', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('page'); expect(await objects(page)).toEqual(original);
  await dialog.getByLabel('Review mark x').fill('50'); await dialog.getByLabel('Review comment', { exact: true }).fill('Stale draft'); await page.evaluate(async () => { const s = (await import('/src/store/useAppStore.ts')).useAppStore.getState(); s.updateObject(s.objects[0].id, { comment: 'Latest comment' }); }); await dialog.getByRole('button', { name: 'Save review mark', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('changed');
  await page.setViewportSize({ width: 390, height: 844 }); expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  const toolbar = (await page.locator('.review-toolbar').boundingBox())!; expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(390); dialog = await manager(page); await dialog.getByLabel('Search review marks').focus(); await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await page.getByLabel('Mobile workspace').getByRole('button', { name: 'Inspector', exact: true }).click();
  await expect(page.getByLabel('Annotation comment')).toHaveValue('Latest comment');
});
