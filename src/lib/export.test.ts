import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, StandardFonts, degrees } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { exportPdf, mergePdfs, splitPdf } from './export';

describe('PDF export engine', () => {
  it('preserves existing form registrations and document metadata when the page sequence stays intact', async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([300, 400]);
    source.setTitle('Original title');
    const field = source.getForm().createTextField('Existing field');
    field.setText('Existing value');
    field.addToPage(page, { x: 20, y: 40, width: 100, height: 24 });
    const data = (await source.save()).buffer as ArrayBuffer;
    const bytes = await exportPdf({ id: 'existing', name: 'form.pdf', size: data.byteLength, modifiedAt: 0, data }, [
      { id: 'edit', type: 'text', page: 1, x: 30, y: 200, text: 'New overlay', color: '#000000', fontSize: 12 },
    ]);
    const result = await PDFDocument.load(bytes);
    expect(result.getTitle()).toBe('Original title');
    expect(result.getForm().getTextField('Existing field').getText()).toBe('Existing value');
  });

  it('exports independent form fields on duplicated pages and composes rotations', async () => {
    const source = await PDFDocument.create();
    source.addPage([300, 400]).setRotation(degrees(90));
    const data = (await source.save()).buffer as ArrayBuffer;
    const document = { id: 'duplicates', name: 'forms.pdf', size: data.byteLength, modifiedAt: 0, data };
    const bytes = await exportPdf(document, [{ id: 'field', type: 'form', kind: 'text', page: 1, x: 20, y: 40, width: 100, height: 24, label: 'Name', value: 'Ada' }], { order: [1, 1], rotations: { 1: 90 }, header: '', footer: '', watermark: '', batesStart: null });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getForm().getFields()).toHaveLength(2);
    expect(pdf.getPage(0).getRotation().angle).toBe(180);
  });

  it('retains the selected standard font when exporting text', async () => {
    const source = await PDFDocument.create(); source.addPage();
    const data = (await source.save()).buffer as ArrayBuffer;
    const bytes = await exportPdf({ id: 'font', name: 'font.pdf', size: data.byteLength, modifiedAt: 0, data }, [{ id: 'text', type: 'text', page: 1, x: 20, y: 40, text: 'Monospaced', fontSize: 12, color: '#000000', fontFamily: 'Courier' }]);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.context.enumerateIndirectObjects().map(([, object]) => object.toString()).join('\n')).toContain('/BaseFont /Courier');
  });
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

  it('exports shapes, tables, and link annotations alongside text', async () => {
    const source = await PDFDocument.create(); source.addPage([300, 300]); const bytes = await source.save();
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const exported = await exportPdf({ id: 'test', name: 'objects.pdf', size: data.byteLength, modifiedAt: 0, data }, [
      { id: 'shape', type: 'shape', page: 1, x: 20, y: 20, width: 40, height: 30, color: '#d65737' },
      { id: 'table', type: 'table', page: 1, x: 70, y: 20, width: 100, height: 40, cells: [['A', 'B'], ['C', 'D']] },
      { id: 'link', type: 'link', page: 1, x: 30, y: 130, label: 'Docs', url: 'https://example.com', fontSize: 12 },
    ]);
    const reopened = await PDFDocument.load(exported);
    expect(reopened.getPage(0).node.Annots()?.size()).toBe(1);
    expect(reopened.getPage(0).node.Contents()).toBeDefined();
  });

  it('applies a page plan, page marks, and browser-local merge/split', async () => {
    const source = await PDFDocument.create(); source.addPage([300, 300]); source.addPage([300, 300]); const bytes = await source.save();
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const document = { id: 'test', name: 'pages.pdf', size: data.byteLength, modifiedAt: 0, data };
    const planned = await exportPdf(document, [], { order: [2, 1, 2], rotations: { 2: 90 }, header: 'Header {page}', footer: 'Footer', watermark: 'CONFIDENTIAL', batesStart: 40 });
    expect((await PDFDocument.load(planned)).getPageCount()).toBe(3);
    expect((await PDFDocument.load(await splitPdf(document, [2]))).getPageCount()).toBe(1);
    expect((await PDFDocument.load(await mergePdfs([document, document]))).getPageCount()).toBe(4);
  });
});
