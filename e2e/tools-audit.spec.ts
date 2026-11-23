import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { openAdvanced } from './advanced-helpers';

test('importing two form values is one Undo operation', async ({ page }) => {
  const pdf = await PDFDocument.create(); const sheet = pdf.addPage([500, 650]);
  for (const [index, name] of ['First', 'Second'].entries()) { const field = pdf.getForm().createTextField(name); field.setText('Original'); field.addToPage(sheet, { x: 40, y: 500 - index * 60, width: 180, height: 24 }); }
  await page.goto('/'); await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'forms.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Tools', exact: true }).click(); await page.getByRole('button', { name: 'Detect form fields', exact: true }).click();
  await expect(page.getByLabel('Field value', { exact: true })).toHaveCount(2);
  await page.getByLabel('Import form data', { exact: true }).setInputFiles({ name: 'values.json', mimeType: 'application/json', buffer: Buffer.from('{"First":"Changed first","Second":"Changed second"}') });
  await expect(page.getByLabel('Field value', { exact: true }).last()).toHaveValue('Changed second');
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.getByLabel('Field value', { exact: true }).first()).toHaveValue('Original');
  await expect(page.getByLabel('Field value', { exact: true }).last()).toHaveValue('Original');
});

test('a delayed document import cannot replace a subsequently opened PDF', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.evaluate(() => { const read = File.prototype.text; File.prototype.text = function () { if (!this.name.endsWith('.txt')) return read.call(this); return new Promise<string>((resolve) => { (window as unknown as { releaseToolsImport: () => void }).releaseToolsImport = () => resolve('Delayed import'); }); }; });
  await page.getByLabel('Import document', { exact: true }).setInputFiles({ name: 'delayed.txt', mimeType: 'text/plain', buffer: Buffer.from('Delayed import') });
  const next = await PDFDocument.create(); next.addPage([300, 400]);
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'newer.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await next.save()) });
  await expect(page.locator('.document-name')).toHaveText('newer.pdf');
  await page.evaluate(() => (window as unknown as { releaseToolsImport: () => void }).releaseToolsImport());
  await expect(page.getByRole('alert')).toContainText('changed');
  await expect(page.locator('.document-name')).toHaveText('newer.pdf');
});

test('opening a malformed protected package keeps the current document', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Tools', exact: true }).click();
  const bytes = await page.evaluate(async () => Array.from(await (await import('/src/lib/security.ts')).encryptPdfPackage(new TextEncoder().encode('%PDF-1.7\nNot a PDF'), 'test-password')));
  page.once('dialog', (dialog) => void dialog.accept('test-password'));
  await page.getByLabel('Open protected package', { exact: true }).setInputFiles({ name: 'malformed.pdfg', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await expect(page.locator('.notice')).toContainText('Could not open');
  await expect(page.locator('.document-name')).toHaveText('advanced.pdf');
});

test('Bates start accepts a multi-digit numeric draft without rewriting its first character', async ({ page }) => {
  await openAdvanced(page); await page.getByRole('button', { name: 'Tools', exact: true }).click();
  const input = page.getByLabel('Bates start', { exact: true });
  await input.fill(''); await input.pressSequentially('125'); await input.press('Tab');
  await expect(input).toHaveValue('125');
});
