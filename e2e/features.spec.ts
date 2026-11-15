import { expect, test, type Page, type Download } from '@playwright/test';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream, StandardFonts } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import forge from 'node-forge';
import { verifyPdfSignatures } from '../src/lib/signatures';

async function open(page: Page, count = 1) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < count; index += 1) pdf.addPage([300, 400]).drawText(`Original page ${index + 1}`, { x: 30, y: 300, size: 16, font: await pdf.embedFont(StandardFonts.Helvetica) });
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'features.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByLabel('Go to page 1', { exact: true })).toBeVisible();
  return pdf;
}

async function bytes(download: Download) { return new Uint8Array(await readFile((await download.path())!)); }

test('formats and wraps an editable text block in the exported PDF', async ({ page }, testInfo) => {
  await open(page);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('A paragraph that should wrap across several lines in a narrow text box.');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByLabel('bold', { exact: true }).click();
  await page.getByLabel('underline', { exact: true }).click();
  await page.getByLabel('Text block width', { exact: true }).fill('100');
  await page.getByLabel('Text alignment', { exact: true }).selectOption('center');
  await expect(page.locator('.text-object')).toHaveCSS('font-weight', '700');
  await expect(page.getByLabel('Export PDF', { exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('formatting.png') });
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await PDFDocument.load(await bytes(await pending));
  expect(pdf.context.enumerateIndirectObjects().map(([, value]) => value.toString()).join('')).toContain('/Helvetica-Bold');
  const contents = pdf.getPage(0).node.Contents() as PDFArray;
  const stream = Array.from({ length: contents.size() }, (_, index) => contents.lookup(index, PDFRawStream)).map((value) => new TextDecoder().decode(decodePDFRawStream(value).decode())).join('');
  expect(stream.match(/ Tj/g)!.length).toBeGreaterThan(4);
});

test('creates radio, choice, date and reset-button fields with properties', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add radio', exact: true }).click();
  await page.getByLabel('Selected field value').selectOption('Option 2');
  await page.getByLabel('Required field').check();
  await page.getByRole('button', { name: 'Add dropdown', exact: true }).click();
  await page.getByLabel('Selected field value').last().selectOption('Option 1');
  await page.getByRole('button', { name: 'Add list', exact: true }).click();
  await page.getByRole('button', { name: 'Add date field', exact: true }).click();
  await page.getByLabel('Field date').fill('2026-11-15');
  await page.getByRole('button', { name: 'Add button field', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const pdf = await PDFDocument.load(await bytes(await pending));
  const fields = pdf.getForm().getFields();
  expect(fields).toHaveLength(5);
  const radio = fields.find((field) => field.constructor.name === 'PDFRadioGroup')!;
  expect(pdf.getForm().getRadioGroup(radio.getName()).getSelected()).toBe('Option 2');
  expect(radio.isRequired()).toBe(true);
  const date = fields.find((field) => field.constructor.name === 'PDFTextField')!;
  expect(pdf.getForm().getTextField(date.getName()).getText()).toBe('2026-11-15');
  const button = fields.find((field) => field.constructor.name === 'PDFButton')!;
  expect(button.acroField.getWidgets()[0].dict.lookup(PDFName.of('A'), PDFDict).get(PDFName.of('S'))).toBe(PDFName.of('ResetForm'));
});

test('secure exports include pending edits and reordered duplicated pages', async ({ page }) => {
  await open(page, 2);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Pending secret');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Move page down', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate page', exact: true }).click();
  const cleanDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Sanitize PDF', exact: true }).click();
  const clean = await PDFDocument.load(await bytes(await cleanDownload));
  expect(clean.getPageCount()).toBe(3);
  expect(clean.getForm().getFields()).toHaveLength(0);
  expect(clean.getPage(1).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict).keys().length).toBeGreaterThan(0);
  await page.getByLabel('Redact text', { exact: true }).fill('Pending secret');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export redacted copy', exact: true }).click();
  const data = await bytes(await pending); const pdf = await PDFDocument.load(data);
  expect(pdf.getPageCount()).toBe(3);
  expect(pdf.getPage(1).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict).keys().length).toBeGreaterThan(0);
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'secure.pdf', mimeType: 'application/pdf', buffer: Buffer.from(data) });
  const canvas = page.getByRole('article', { name: 'Page 2', exact: true }).locator('canvas');
  await expect(canvas).toHaveJSProperty('width', 450);
  await expect.poll(() => canvas.evaluate((element) => [...element.getContext('2d')!.getImageData(120, 492, 1, 1).data].slice(0, 3).every((value) => value < 20))).toBe(true);
  await expect(page.locator('.text-layer')).toHaveText(['', '', '']);
});

test('exports current edits as DOCX, XLSX, Markdown and page images', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay', exact: true }).click();
  await page.getByLabel('Overlay text').fill('Current converted edit');
  await page.getByRole('button', { name: 'Add table', exact: true }).click();
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  for (const format of ['DOCX', 'XLSX', 'MD', 'JPG', 'WEBP', 'ZIP', 'print PDF']) {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: `Export ${format}`, exact: true }).click();
    const data = await bytes(await pending);
    if (format === 'DOCX') expect(strFromU8(unzipSync(data)['word/document.xml'])).toContain('Current converted edit');
    if (format === 'XLSX') expect(Object.keys(unzipSync(data))).toContain('xl/workbook.xml');
    if (format === 'MD') expect(new TextDecoder().decode(data)).toContain('Current converted edit');
    if (format === 'JPG') expect([...data.slice(0, 2)]).toEqual([255, 216]);
    if (format === 'WEBP') expect(new TextDecoder().decode(data.slice(0, 4))).toBe('RIFF');
    if (format === 'ZIP') expect(Object.keys(unzipSync(data))).toHaveLength(1);
    if (format === 'print PDF') expect((await PDFDocument.load(data)).getPageCount()).toBe(1);
  }
});

test('imports text, Markdown, HTML, images and DOCX locally', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  for (const [name, content] of [['text.txt', 'Imported text'], ['markdown.md', '# Imported heading'], ['markup.html', '<h1>Imported HTML</h1><script>throw Error()</script>']]) {
    await page.getByLabel('Import document', { exact: true }).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(content) });
    await expect(page.locator('.document-name')).toHaveText(name.replace(/\.[^.]+$/, '.pdf'));
    await expect(page.locator('.text-layer')).toContainText('Imported');
  }
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export DOCX', exact: true }).click();
  await page.getByLabel('Import document', { exact: true }).setInputFiles({ name: 'imported.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(await bytes(await pending)) });
  await expect(page.locator('.document-name')).toHaveText('imported.pdf');
  await expect(page.locator('.text-layer')).toContainText('Imported HTML');
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; return canvas.toDataURL().split(',')[1]; });
  await page.getByLabel('Import document', { exact: true }).setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('.document-name')).toHaveText('image.pdf');
  await expect(page.getByLabel('Rendered PDF pages')).toBeVisible();
});

test('detects existing fields, imports local values, and preserves them after reordering', async ({ page }) => {
  const source = await PDFDocument.create(); const first = source.addPage([300, 400]); source.addPage([300, 400]);
  const field = source.getForm().createTextField('Customer'); field.setText('Original'); field.addToPage(first, { x: 30, y: 100, width: 180, height: 24 });
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'existing.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await source.save()) });
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Detect form fields', exact: true }).click();
  await expect(page.getByLabel('Field value', { exact: true })).toHaveValue('Original');
  await page.getByLabel('Import form data', { exact: true }).setInputFiles({ name: 'values.json', mimeType: 'application/json', buffer: Buffer.from('{"Customer":"Updated customer"}') });
  await expect(page.getByLabel('Field value', { exact: true })).toHaveValue('Updated customer');
  await page.getByRole('button', { name: 'Move page down', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByLabel('Export PDF', { exact: true }).click();
  const result = await PDFDocument.load(await bytes(await pending));
  expect(result.getForm().getTextField('Customer').getText()).toBe('Updated customer');
});

test('signs a PDF with a local P12 certificate and verifies its CMS signature', async ({ page }) => {
  test.setTimeout(60000);
  await open(page);
  const keys = forge.pki.rsa.generateKeyPair(2048); const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey; certificate.serialNumber = '01';
  certificate.validity.notBefore = new Date('2025-01-01'); certificate.validity.notAfter = new Date('2035-01-01');
  certificate.setSubject([{ name: 'commonName', value: 'Local Test Signer' }]); certificate.setIssuer(certificate.subject.attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [certificate], 'test-password', { algorithm: 'aes256' });
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Certificate signing', exact: true }).click();
  await page.getByLabel('Signing certificate').setInputFiles({ name: 'test.p12', mimeType: 'application/x-pkcs12', buffer: Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary') });
  await page.getByLabel('Certificate password', { exact: true }).fill('test-password');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Sign and download', exact: true }).click();
  const reports = await verifyPdfSignatures(await bytes(await pending));
  expect(reports[0]).toMatchObject({ valid: true, coversWholeFile: true });
  await expect(page.getByText('Signature integrity valid', { exact: true })).toBeVisible();
});

test('recognizes a scanned PDF with bundled offline OCR and no external requests', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 400;
    const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, 1200, 400);
    context.fillStyle = 'black'; context.font = 'bold 54px Arial'; context.fillText('INVOICE TOTAL 12345', 60, 180);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const pdf = await PDFDocument.create(); const png = await pdf.embedPng(Buffer.from(image, 'base64'));
  pdf.addPage([600, 200]).drawImage(png, { x: 0, y: 0, width: 600, height: 200 });
  const external: string[] = []; page.on('request', (request) => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5173/')) external.push(request.url()); });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Offline OCR', exact: true }).click();
  await page.getByLabel('OCR language', { exact: true }).selectOption('eng+spa');
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel OCR', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recognize document', exact: true })).toBeEnabled();
  await expect(page.locator('.text-layer')).toHaveText('');
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await expect(page.locator('.text-layer')).toContainText('INVOICE', { timeout: 100000 });
  expect(external).toEqual([]);
});
