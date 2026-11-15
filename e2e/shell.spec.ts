import { expect, test } from '@playwright/test';

test('shows a browser-local PDF workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Open a PDF to begin' })).toBeVisible();
  await expect(page.getByText('no uploads')).toBeVisible();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
});

test('opens and renders a local PDF', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open PDF').setInputFiles({
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 46 >>\nstream\nBT /F1 18 Tf 50 150 Td (PDFForge search text) Tj ET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'),
  });
  await expect(page.getByLabel('Rendered PDF pages')).toBeVisible();
  await expect(page.getByLabel('Go to page 1')).toBeVisible();
});

test('exports a PDF with a text object', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open PDF').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF') });
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text overlay' }).click();
  await page.getByRole('button', { name: 'Add shape' }).click();
  await page.getByRole('button', { name: 'Add table' }).click();
  await page.getByRole('button', { name: 'Add link' }).click();
  await page.getByLabel('Overlay text').fill('Exported note');
  await expect(page.getByText('Header 1')).toBeVisible();
  await expect(page.getByRole('link', { name: 'https://example.com' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByLabel('Export PDF').click();
  expect((await download).suggestedFilename()).toBe('sample-edited.pdf');
});
