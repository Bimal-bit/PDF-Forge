import { PDFDocument, PDFName, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';
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
    const pdf = await PDFDocument.load(redacted);
    const decoded = pdf.context.enumerateIndirectObjects().filter((entry): entry is [typeof entry[0], PDFRawStream] => entry[1] instanceof PDFRawStream).map(([, stream]) => new TextDecoder().decode(decodePDFRawStream(stream).decode())).join('\n');
    expect(decoded).not.toContain('546F7020536563726574');
    expect(decoded).not.toContain('Top Secret');
  });

  it('rejects output containing sensitive text in an unreferenced stream', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage();
    pdf.context.register(pdf.context.flateStream('BT (Top Secret) Tj ET'));
    await expect(verifyRedaction(await pdf.save(), ['Top Secret'])).resolves.toBe(false);
  });

  it('refuses nested page content that it cannot securely redact', async () => {
    const document = await sourceDocument();
    const pdf = await PDFDocument.load(document.data);
    const form = pdf.context.flateStream('BT (Top Secret) Tj ET', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 100, 100] });
    pdf.getPage(0).node.Resources()!.set(PDFName.of('XObject'), pdf.context.obj({ Nested: pdf.context.register(form) }));
    const data = (await pdf.save()).buffer as ArrayBuffer;
    await expect(redactPdf({ ...document, data }, ['Top Secret'])).rejects.toThrow('nested content');
  });

  it('refuses raw non-ASCII streams and inline images instead of rewriting their bytes', async () => {
    const document = await sourceDocument();
    const pdf = await PDFDocument.load(document.data);
    for (const content of ['BT (Caf\u00e9 Top Secret) Tj ET', 'BI /W 1 /H 1 /BPC 8 /CS /G ID x EI\nBT (Top Secret) Tj ET']) {
      const bytes = Uint8Array.from(content, (character) => character.charCodeAt(0));
      pdf.getPage(0).node.set(PDFName.of('Contents'), pdf.context.register(pdf.context.flateStream(bytes)));
      const data = (await pdf.save()).buffer as ArrayBuffer;
      await expect(redactPdf({ ...document, data }, ['Top Secret'])).rejects.toThrow(/non-ASCII|inline images/);
    }
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
