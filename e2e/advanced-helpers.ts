import { expect, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFArray, PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';

export async function openAdvanced(page: Page, count = 1, text = '') {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < count; index += 1) {
    const sheet = pdf.addPage([500, 650]);
    if (text) sheet.drawText(text, { x: 40, y: 550, size: 12, font });
  }
  await page.goto('/');
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'advanced.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByRole('article', { name: 'Page 1', exact: true }).locator('canvas')).toHaveJSProperty('width', 750);
}

export async function downloadPdf(download: Download) { return PDFDocument.load(await readFile((await download.path())!)); }

export function pageStreams(pdf: PDFDocument, index = 0) {
  const streams = pdf.getPage(index).node.Contents() as PDFArray | undefined;
  if (!streams) return '';
  return Array.from({ length: streams.size() }, (_, i) => new TextDecoder().decode(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode())).join('\n');
}
