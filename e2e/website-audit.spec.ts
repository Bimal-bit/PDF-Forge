import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { openAdvanced } from './advanced-helpers';

async function palette(page: Page, query = '') {
  await page.getByRole('button', { name: 'Search actions', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Command palette', exact: true });
  await dialog.getByLabel('Search commands').fill(query);
  return dialog;
}

test('action search runs the highlighted result with Enter and restores focus on Escape', async ({ page }) => {
  await openAdvanced(page, 1, 'Keyboard accessible document');
  let dialog = await palette(page, 'accessibility');
  await dialog.getByLabel('Search commands').press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Accessibility report', { exact: true })).toBeVisible();
  dialog = await palette(page);
  await dialog.getByLabel('Search commands').press('ArrowDown');
  await dialog.getByLabel('Search commands').press('Enter');
  await expect(page.getByLabel('Local AI panel', { exact: true })).toBeVisible();
  dialog = await palette(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Search actions', exact: true })).toBeFocused();
});

test('action search contains keyboard focus and explains empty results', async ({ page }) => {
  await openAdvanced(page);
  const dialog = await palette(page, 'No such command');
  await expect(dialog).toContainText('No commands found');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 9; index += 1) {
    await page.keyboard.press(index % 2 ? 'Shift+Tab' : 'Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Control+k');
  await expect(dialog).toHaveCount(0);
});

test('action-search insertion stays inside the current cropped page and exits selection mode', async ({ page }) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([600, 700]);
  sheet.setCropBox(180, 260, 220, 240);
  sheet.drawText('Cropped source', { x: 200, y: 450, size: 12 });
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'crop.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.locator('.text-layer')).toContainText('Cropped source');
  await page.getByRole('button', { name: 'Select text', exact: true }).click();
  const dialog = await palette(page, 'Add text overlay');
  await dialog.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  const inserted = await page.evaluate(async () => {
    const state = (await import('/src/store/useAppStore.ts')).useAppStore.getState();
    return { object: state.objects.at(-1), mode: (await import('/src/store/useTextSelectionStore.ts')).useTextSelectionStore.getState().mode };
  });
  expect(inserted.mode).toBe('edit');
  expect(inserted.object?.x).toBeGreaterThanOrEqual(180);
  expect(inserted.object?.y).toBeGreaterThanOrEqual(260);
  expect(inserted.object?.type === 'text' && inserted.object.x + (inserted.object.width ?? 0)).toBeLessThanOrEqual(400);
  await expect(page.locator('.text-object')).toBeInViewport();
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(0);
});

test('Undo shortcuts cannot change the document behind a modal dialog', async ({ page }) => {
  await openAdvanced(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Insert table', exact: true });
  await dialog.getByLabel('Close Insert table', { exact: true }).focus();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(async () => (await import('/src/store/useAppStore.ts')).useAppStore.getState().objects.length)).toBe(1);
  await page.keyboard.press('Escape');
  await page.locator('.canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.text-object')).toHaveCount(0);
});

test('editor skip navigation focuses the document and ribbon selection has an accessible state', async ({ page }) => {
  await openAdvanced(page);
  await page.getByRole('link', { name: 'Skip to document', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Document canvas', { exact: true })).toBeFocused();
  const tabs = page.getByRole('navigation', { name: 'Ribbon tabs' });
  for (const name of ['Home', 'Insert', 'Layout', 'Review', 'View', 'Tools']) {
    const button = tabs.getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-current', 'page');
    await expect(tabs.locator('[aria-current=page]')).toHaveCount(1);
  }
});

test('the workspace only shows file-drop feedback for files and keeps it while crossing child elements', async ({ page }) => {
  await openAdvanced(page);
  await page.evaluate(() => {
    const transfer = new DataTransfer(); transfer.setData('text/plain', 'Selected document text');
    document.querySelector('.workspace')!.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
  });
  await expect(page.locator('.drop-overlay')).toHaveCount(0);
  await page.evaluate(() => {
    const transfer = new DataTransfer(); transfer.items.add(new File(['%PDF-'], 'local.pdf', { type: 'application/pdf' }));
    document.querySelector('.workspace')!.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
    document.querySelector('.canvas')!.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: document.querySelector('.text-layer') }));
  });
  await expect(page.locator('.drop-overlay')).toContainText('PDF or image');
  await page.locator('.workspace').dispatchEvent('dragleave', { relatedTarget: null });
  await expect(page.locator('.drop-overlay')).toHaveCount(0);
});

test('mobile navigation dismisses with Escape and outside interaction and skip link moves focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  await toggle.click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Features', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.locator('.landing-description').click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('link', { name: 'Skip to tools', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#toolbox')).toBeFocused();
});

test('titlebar export blocks duplicate work and discards output after edits', async ({ page }) => {
  await openAdvanced(page);
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20;
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByLabel('Add image', { exact: true }).setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await expect(page.locator('.image-object')).toHaveCount(1);
  await page.evaluate(() => {
    const fetch = window.fetch;
    window.fetch = (input, init) => String(input).startsWith('data:image/')
      ? new Promise<Response>((resolve) => { (window as unknown as { releaseExport: () => void }).releaseExport = () => { void fetch(input, init).then(resolve); }; })
      : fetch(input, init);
  });
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  const button = page.getByLabel('Export PDF', { exact: true });
  await button.click();
  await expect(button).toBeDisabled();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.evaluate(() => (window as unknown as { releaseExport: () => void }).releaseExport());
  await expect(page.getByRole('alert')).toContainText('document changed');
  await expect(button).toBeEnabled();
  expect(downloads).toEqual([]);
});

test('leaving the page flushes the current local workspace before the five-second interval', async ({ page }) => {
  await openAdvanced(page);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByLabel('Overlay text', { exact: true }).fill('Save before switching apps');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(async () => (await (await import('/src/lib/storage.ts')).loadLatestDocument())?.objects?.some((object) => object.type === 'text' && object.text === 'Save before switching apps')), { timeout: 2500 }).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Overlay text', { exact: true })).toHaveValue('Save before switching apps');
});

test('closing signing tools discards a delayed job and opening another document clears credentials', async ({ page }) => {
  await openAdvanced(page);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Certificate signing', exact: true }).click();
  await page.getByLabel('Signing certificate').setInputFiles({ name: 'slow.p12', mimeType: 'application/x-pkcs12', buffer: Buffer.from('not a certificate') });
  await page.getByLabel('Certificate password', { exact: true }).fill('private-password');
  const other = await PDFDocument.create(); other.addPage();
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'other.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await other.save()) });
  await expect(page.getByLabel('Certificate password', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Sign and download', exact: true })).toBeDisabled();
  await page.getByLabel('Signing certificate').setInputFiles({ name: 'slow.p12', mimeType: 'application/x-pkcs12', buffer: Buffer.from('not a certificate') });
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      return this.name === 'slow.p12'
        ? new Promise<ArrayBuffer>((resolve) => { (window as unknown as { releaseSign: () => void }).releaseSign = () => { void read.call(this).then(resolve); }; })
        : read.call(this);
    };
  });
  await page.getByRole('button', { name: 'Sign and download', exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseSign?: () => void }).releaseSign)).toBe('function');
  await page.getByLabel('Close certificate panel').click();
  await page.getByRole('alert').click();
  await page.evaluate(() => (window as unknown as { releaseSign: () => void }).releaseSign());
  // A fresh job gives the closed operation time to settle without a timing-only assertion.
  await page.getByRole('button', { name: 'Check accessibility', exact: true }).click();
  await expect(page.getByLabel('Accessibility report', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
