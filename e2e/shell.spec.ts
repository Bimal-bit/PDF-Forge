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

test('creates review annotations and exposes XFDF exchange', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open PDF').setInputFiles({ name: 'review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF') });
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Highlight' }).click();
  await page.getByRole('button', { name: 'Add comment' }).click();
  await page.getByRole('button', { name: 'Approved stamp' }).click();
  await page.getByRole('button', { name: 'Measure' }).click();
  await expect(page.getByLabel('Annotation comment').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export XFDF' })).toBeVisible();
  await expect(page.getByText('Import XFDF', { exact: true })).toBeVisible();
});

test('exposes M6 page management and repeating marks', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open PDF').setInputFiles({ name: 'pages.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\n4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF') });
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rotate page' })).toBeVisible();
  await expect(page.getByText('Merge PDFs', { exact: true })).toBeVisible();
  await page.getByLabel('Header').fill('Case {page}');
  await page.getByLabel('Footer').fill('Private');
  await page.getByLabel('Watermark').fill('DRAFT');
  await page.getByLabel('Bates start').fill('10');
  await page.getByRole('button', { name: 'Duplicate page' }).click();
  await page.getByRole('button', { name: 'Rotate page' }).click();
});

test('adds local form fields and exposes CSV mail merge', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open PDF').setInputFiles({ name: 'forms.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF') });
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await page.getByRole('button', { name: 'Add text field' }).click();
  await page.getByRole('button', { name: 'Add checkbox' }).click();
  await page.getByRole('button', { name: 'Add signature field' }).click();
  await expect(page.getByLabel('Field value')).toBeVisible();
  await expect(page.getByLabel('Signer name')).toBeVisible();
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(page.getByText('Mail merge CSV', { exact: true })).toBeVisible();
});

test('exposes verified redaction, sanitization, and package protection', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open PDF').setInputFiles({ name: 'security.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF') });
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByLabel('Redact text').fill('Secret');
  await expect(page.getByRole('button', { name: 'Export redacted copy' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Sanitize PDF' })).toBeVisible();
  await page.getByLabel('Package password').fill('eightchars');
  await expect(page.getByRole('button', { name: 'Export protected package' })).toBeEnabled();
});

test('exposes local M9 conversion, extraction, optimization, and comparison tools', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open PDF').setInputFiles({ name: 'm9.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF') });
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export text' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export HTML' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export page PNG' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Extract tables CSV' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Optimize PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare PDF' })).toBeVisible();
});
