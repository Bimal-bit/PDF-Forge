import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { decryptPdfPackage, encryptPdfPackage, extractPdfText, redactPdf, sanitizePdf, verifyRedaction } from './security';

async function sourceDocument() {
  const source = await PDFDocument.create();
  const page = source.addPage([300, 300]);
  page.drawText('Public Top Secret material', { x: 30, y: 220, font: await source.embedFont(StandardFonts.Helvetica) });
  const link = source.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [20, 20, 40, 40], Contents: 'Remove this annotation' });
  page.node.set(PDFName.of('Annots'), source.context.obj([source.context.register(link)]));
  source.setTitle('Sensitive title');
  const bytes = await source.save(); const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { id: 'security', name: 'security.pdf', size: data.byteLength, modifiedAt: 0, data };
}

describe('redaction and security', () => {
  it('removes matching text from extracted output and verifies the removal', async () => {
    const redacted = await redactPdf(await sourceDocument(), ['Top Secret']);
    expect(await extractPdfText(redacted)).toContain('Public');
    expect(await extractPdfText(redacted)).not.toContain('Top Secret');
    await expect(verifyRedaction(redacted, ['Top Secret'])).resolves.toBe(true);
  });

  it('sanitizes annotations and metadata from a copied document', async () => {
    const sanitized = await sanitizePdf(await sourceDocument());
    const pdf = await PDFDocument.load(sanitized);
    expect(pdf.getPage(0).node.Annots()).toBeUndefined();
    expect(pdf.getTitle()).toBe('Sanitized document');
  });

  it('creates a password-encrypted package rather than a misleading PDF password', async () => {
    const protectedBytes = await encryptPdfPackage(new TextEncoder().encode('%PDF-test'), 'eightchars');
    expect(new TextDecoder().decode(protectedBytes)).toMatch(/^PDFForge Secure v1\n/);
    expect(new TextDecoder().decode(protectedBytes)).not.toContain('%PDF-test');
    expect(new TextDecoder().decode(await decryptPdfPackage(protectedBytes, 'eightchars'))).toBe('%PDF-test');
  });
});
