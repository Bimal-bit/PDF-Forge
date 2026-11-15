import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { toPdfDocument } from './file';

describe('PDF file validation', () => {
  it('accepts a parsed PDF with pages', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage();
    const data = await pdf.save();
    const file = { name: 'sample.pdf', type: 'application/pdf', size: data.byteLength, arrayBuffer: async () => data.buffer } as File;
    await expect(toPdfDocument(file)).resolves.toMatchObject({ name: 'sample.pdf' });
  });
  it('rejects a PDF header followed by damaged document data', async () => {
    const file = { name: 'broken.pdf', type: 'application/pdf', arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7 minimal').buffer } as File;
    await expect(toPdfDocument(file)).rejects.toThrow('not a valid PDF');
  });
  it('rejects another file type', async () => {
    await expect(toPdfDocument(new File(['hello'], 'note.txt'))).rejects.toThrow('Choose a PDF');
  });
});
