import { expect, test, type Page } from '@playwright/test';
import { openAdvanced, downloadPdf, pageStreams } from './advanced-helpers';

async function addText(page: Page, text: string) {
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text').last().fill(text);
}
async function state(page: Page) {
  return page.evaluate(async () => { const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState(); return { objects: state.objects, history: state.history.length, changes: state.textChanges }; });
}

test('Home replaces literal text with case options and preserves formatting/position through undo/export/recovery', async ({ page }) => {
  await openAdvanced(page); await addText(page, 'a.b A.B a?b');
  await page.getByLabel('Font family', { exact: true }).selectOption('Courier');
  await page.getByLabel('bold', { exact: true }).click();
  const before = await state(page);
  await page.getByRole('button', { name: 'Replace text', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Replace selected text', exact: true });
  await expect(dialog.getByRole('button', { name: 'Replace all in selection' })).toBeDisabled();
  await dialog.getByLabel('Find text to replace', { exact: true }).fill('a.b');
  await dialog.getByLabel('Replacement text', { exact: true }).fill('$&');
  await expect(dialog.getByText('2 matches in the selected blocks.', { exact: false })).toBeVisible();
  await dialog.getByLabel('Match case', { exact: true }).check();
  await expect(dialog.getByText('1 match in the selected blocks.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Replace all in selection', exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('$& A.B a?b');
  const after = await state(page), object = after.objects[0];
  expect(after.history).toBe(before.history + 1);
  expect(object).toMatchObject({ ...before.objects[0], text: '$& A.B a?b' });
  await page.getByLabel('Undo', { exact: true }).click(); await expect(page.getByLabel('Overlay text')).toHaveValue('a.b A.B a?b');
  await page.getByLabel('Redo', { exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await downloadPdf(await pending); expect(pageStreams(pdf)).toContain('242620412E4220613F62');
  expect(pdf.context.enumerateIndirectObjects().map(([, object]) => object.toString()).join('')).toContain('/Courier-Bold');
  await expect(page.getByRole('status')).toHaveText('Saved locally', { timeout: 8000 }); await page.reload();
  await expect(page.getByLabel('Overlay text')).toHaveValue('$& A.B a?b');
});

test('Replace updates selected source runs and inserted blocks across pages in one tracked operation', async ({ page }) => {
  await openAdvanced(page, 2, 'Source BLUE');
  await addText(page, 'Blue BLUE'); await addText(page, 'blue');
  await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().setReviewOptions({ trackChanges: true, changeAuthor: 'Audit' }));
  await page.getByRole('button', { name: 'Select all text', exact: true }).click();
  await expect(page.getByLabel('Home selection details')).toContainText('4 text runs selected');
  const before = await state(page);
  await page.getByRole('button', { name: 'Replace text', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Replace selected text', exact: true });
  await dialog.getByLabel('Find text to replace', { exact: true }).fill('blue');
  await dialog.getByLabel('Replacement text', { exact: true }).fill('Green');
  await expect(dialog.getByText('5 matches in the selected blocks.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Replace all in selection', exact: true }).click();
  const after = await state(page);
  expect(after.history).toBe(before.history + 1);
  expect(after.objects.filter((object) => object.type === 'text').map((object) => object.text).sort()).toEqual(['Green', 'Green Green', 'Source Green', 'Source Green']);
  expect(after.changes.filter((change) => change.status === 'pending')).toHaveLength(4);
  await page.getByLabel('bold', { exact: true }).click();
  expect((await state(page)).objects.filter((object) => object.type === 'text').every((object) => object.bold)).toBe(true);
  await page.getByLabel('Undo', { exact: true }).click(); await page.getByLabel('Undo', { exact: true }).click();
  expect((await state(page)).objects).toEqual(before.objects);
  await page.getByLabel('Redo', { exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  expect((await downloadPdf(await pending)).getPageCount()).toBe(2);
});

test('Cleanup previews each whitespace operation and keeps group formatting available', async ({ page }) => {
  await openAdvanced(page); await addText(page, '  One\t  two  \n \n Three  '); await addText(page, ' A  B ');
  await page.getByRole('button', { name: 'Select all text', exact: true }).click(); await expect(page.getByLabel('Home selection details')).toContainText('2 text runs selected');
  const steps = [
    ['spaces', ' One two \n \n Three ', ' A B '],
    ['trim', 'One two\n\nThree', 'A B'],
    ['empty-lines', 'One two\nThree', 'A B'],
  ];
  for (const [mode, first, second] of steps) {
    await page.getByRole('button', { name: 'Clean up text', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Clean up selected text', exact: true });
    await dialog.getByLabel('Text cleanup', { exact: true }).selectOption(mode);
    await expect(dialog.getByLabel('After block 1', { exact: true })).toHaveText(first);
    const before = (await state(page)).history;
    await dialog.getByRole('button', { name: 'Apply cleanup', exact: true }).click();
    expect((await state(page)).history).toBe(before + 1);
    await expect(page.getByLabel('Overlay text').first()).toHaveValue(first); await expect(page.getByLabel('Overlay text').last()).toHaveValue(second);
  }
  await page.getByLabel('italic', { exact: true }).click();
  expect((await state(page)).objects.filter((object) => object.type === 'text').every((object) => object.italic)).toBe(true);
});

test('text tools reject stale snapshots, avoid no-op edits, and cancel with Escape on narrow screens', async ({ page }) => {
  await openAdvanced(page); await addText(page, 'Already clean');
  const before = await state(page);
  await page.getByRole('button', { name: 'Clean up text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply cleanup', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); expect((await state(page)).history).toBe(before.history);
  await page.getByRole('button', { name: 'Replace text', exact: true }).click();
  await page.getByLabel('Find text to replace', { exact: true }).fill('clean'); await page.getByLabel('Replacement text', { exact: true }).fill('new');
  await page.evaluate(async () => { const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState(); state.updateTextObject(state.objects[0].id, 'Newer text'); });
  await page.getByRole('button', { name: 'Replace all in selection', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('document or selection changed');
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = (await page.getByRole('dialog').boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await page.getByLabel('Mobile workspace').getByRole('button', { name: 'Inspector', exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Newer text');
});

test('Replace opens with the latest text typed in an active caret editor', async ({ page }) => {
  await openAdvanced(page, 1, 'Original source');
  await page.locator('.text-layer span').filter({ hasText: 'Original source' }).click();
  await page.getByLabel('Edit PDF text', { exact: true }).fill('Newest source input');
  await page.getByRole('button', { name: 'Replace text', exact: true }).click();
  await expect(page.getByLabel('Before block 1', { exact: true })).toHaveText('Newest source input');
  await page.getByLabel('Find text to replace', { exact: true }).fill('Newest');
  await page.getByLabel('Replacement text', { exact: true }).fill('Current');
  await page.getByRole('button', { name: 'Replace all in selection', exact: true }).click();
  await expect(page.getByLabel('Overlay text')).toHaveValue('Current source input');
  await page.getByLabel('Undo', { exact: true }).click(); await expect(page.getByLabel('Overlay text')).toHaveValue('Newest source input');
});
