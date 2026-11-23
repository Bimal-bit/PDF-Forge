/* global Buffer, console, document, FontFace */
import { chromium, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:5173');
  const png = await page.evaluate(async () => {
    const face = new FontFace('ImageSourceFont', 'url(/fonts/catalog/poppins/700-normal.ttf)', { weight: '700' });
    await face.load(); document.fonts.add(face);
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 240;
    const c = canvas.getContext('2d'); c.fillStyle = '#fff2d9'; c.fillRect(0, 0, 1200, 240);
    c.font = '700 42px ImageSourceFont'; c.fillStyle = '#b82035'; c.fillText('EMBEDDED IMAGE TOTAL 12345', 24, 130);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const pdf = await PDFDocument.create(), sheet = pdf.addPage([500, 700]);
  sheet.drawText('Native PDF heading', { x: 50, y: 620, size: 22 });
  sheet.drawImage(await pdf.embedPng(Buffer.from(png, 'base64')), { x: 50, y: 350, width: 400, height: 80 });
  await page.getByLabel('Open PDF', { exact: true }).setInputFiles({ name: 'embedded.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Edit text in images', exact: true }).click();
  await mkdir('docs/images', { recursive: true });
  await page.screenshot({ path: 'docs/images/embedded-ocr-settings.png' });
  await page.getByRole('button', { name: 'Recognize document', exact: true }).click();
  await expect(page.getByLabel('OCR line 1', { exact: true })).toHaveValue('EMBEDDED IMAGE TOTAL 12345', { timeout: 100000 });
  await page.screenshot({ path: 'docs/images/embedded-ocr-review.png' });
  await page.getByRole('button', { name: 'Compare / change font', exact: true }).click();
  await expect(page.getByLabel('OCR font family 1', { exact: true })).toHaveValue('Poppins');
  await expect(page.getByLabel('OCR font family 1', { exact: true })).toBeEnabled();
  await page.screenshot({ path: 'docs/images/ocr-font-comparison.png' });
  await page.getByRole('button', { name: 'Apply editable text', exact: true }).click();
  await expect(page.locator('.text-object')).toHaveCount(1);
  await page.getByRole('alert').click(); await page.mouse.move(0, 0);
  await page.screenshot({ path: 'docs/images/embedded-ocr-original.png' });
  await page.getByLabel('Overlay text', { exact: true }).fill('EMBEDDED IMAGE TOTAL 54321');
  await page.getByLabel('Find text in document', { exact: true }).click(); await page.mouse.move(0, 0);
  await page.screenshot({ path: 'docs/images/embedded-ocr-edited.png' });
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Mobile workspace').getByRole('button', { name: 'Scan text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recognize document', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'docs/images/embedded-ocr-phone.png' });
  console.log(JSON.stringify({ errors }));
} finally { await browser.close(); }
