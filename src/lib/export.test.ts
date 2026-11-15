import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { exportPdf } from './export';

describe('PDF export engine', () => {
  it('round-trips a source PDF and merges its text object layer', async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([300, 300]);
    page.drawText('Source text', { x: 30, y: 260, font: await source.embedFont(StandardFonts.Helvetica) });
    const sourceBytes = await source.save();
    const data = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength) as ArrayBuffer;
    const exported = await exportPdf({ id: 'test', name: 'source.pdf', size: data.byteLength, modifiedAt: 0, data }, [{ id: 'overlay', type: 'text', page: 1, text: 'Merged overlay', x: 40, y: 100, fontSize: 14, color: '#d65737' }]);
    const reopened = await PDFDocument.load(exported);
    expect(reopened.getPageCount()).toBe(1);
    const contents = reopened.getPage(0).node.Contents();
    const streams = contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, index) => contents.lookup(index, PDFRawStream)) : [contents as PDFRawStream];
    const decoded = streams.map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode())).join('');
    expect(decoded).toContain('4D6572676564206F7665726C6179');
  });
});
