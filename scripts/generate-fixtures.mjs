import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { chromium } from '@playwright/test';
import { Buffer } from 'node:buffer';

await mkdir('fixtures', { recursive: true });
const create = async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  return { pdf, font };
};
const text = await create();
text.pdf.addPage([612, 792]).drawText('PDFForge text fixture\nEdit this paragraph and export a copy.', { x: 48, y: 720, size: 18, font: text.font, lineHeight: 26 });
await writeFile('fixtures/text.pdf', await text.pdf.save());

const form = await create();
const page = form.pdf.addPage([612, 792]);
page.drawText('PDFForge form fixture', { x: 48, y: 720, size: 20, font: form.font });
const name = form.pdf.getForm().createTextField('Customer');
name.setText('Sample customer'); name.addToPage(page, { x: 48, y: 620, width: 240, height: 28 });
const consent = form.pdf.getForm().createCheckBox('Consent'); consent.addToPage(page, { x: 48, y: 560, width: 20, height: 20 });
await writeFile('fixtures/form.pdf', await form.pdf.save());

const columns = await create(); const columnPage = columns.pdf.addPage([612, 792]);
for (let index = 0; index < 15; index += 1) {
  columnPage.drawText(`Left column line ${index + 1}`, { x: 48, y: 720 - index * 24, font: columns.font, size: 12 });
  columnPage.drawText(`Right column line ${index + 1}`, { x: 330, y: 720 - index * 24, font: columns.font, size: 12 });
}
await writeFile('fixtures/multi-column.pdf', await columns.pdf.save());

const large = await create();
for (let index = 1; index <= 300; index += 1) large.pdf.addPage([612, 792]).drawText(`PDFForge large fixture - page ${index}`, { x: 48, y: 720, font: large.font, size: 16 });
await writeFile('fixtures/large.pdf', await large.pdf.save());

const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  const image = await tab.evaluate(() => {
    const canvas = globalThis.document.createElement('canvas'); canvas.width = 1224; canvas.height = 1584;
    const context = canvas.getContext('2d'); context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111111'; context.font = 'bold 48px Arial'; context.fillText('PDFForge scanned fixture', 96, 160);
    context.font = '36px Arial'; context.fillText('INVOICE TOTAL 12345', 96, 260);
    context.fillText('FACTURA TOTAL 12345', 96, 330);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const scan = await PDFDocument.create(); const png = await scan.embedPng(Buffer.from(image, 'base64'));
  scan.addPage([612, 792]).drawImage(png, { x: 0, y: 0, width: 612, height: 792 });
  await writeFile('fixtures/scanned.pdf', await scan.save());
} finally { await browser.close(); }
