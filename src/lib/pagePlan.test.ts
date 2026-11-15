import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { exportPdf } from './export';
import type { PageSettings } from '../types';

describe('catalog preservation during page assembly', () => {
  it('keeps opaque form data when reordering pages without editing forms', async () => {
    const source = await PDFDocument.create(); source.addPage(); source.addPage();
    const packet = source.context.register(source.context.flateStream('<template>Preserve opaque data</template>'));
    source.catalog.set(PDFName.of('AcroForm'), source.context.obj({ Fields: [], XFA: packet }));
    const data = (await source.save()).buffer as ArrayBuffer;
    const bytes = await exportPdf({ id: 'opaque', name: 'opaque.pdf', data, size: data.byteLength, modifiedAt: 0 }, [], { order: [2, 1], rotations: {}, header: '', footer: '', watermark: '', batesStart: null });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.catalog.lookup(PDFName.of('AcroForm'), PDFDict).has(PDFName.of('XFA'))).toBe(true);
  });
  it('retains metadata, bookmarks, names, existing fields, and cloned fields after reorder and duplication', async () => {
    const source = await PDFDocument.create();
    source.setTitle('Preserve me');
    const first = source.addPage([300, 400]); source.addPage([400, 500]);
    const field = source.getForm().createTextField('Customer'); field.setText('Ada');
    field.addToPage(first, { x: 20, y: 30, width: 100, height: 20 });
    const outline = source.context.obj({ Type: 'Outlines' });
    const outlineRef = source.context.register(outline);
    const entry = source.context.register(source.context.obj({ Title: PDFString.of('First page'), Parent: outlineRef, Dest: [first.ref, 'Fit'] }));
    outline.set(PDFName.of('First'), entry); outline.set(PDFName.of('Last'), entry);
    source.catalog.set(PDFName.of('Outlines'), outlineRef);
    source.catalog.set(PDFName.of('Names'), source.context.obj({ Dests: { Names: [PDFString.of('start'), [first.ref, 'Fit']] } }));
    const data = (await source.save()).buffer as ArrayBuffer;
    const settings: PageSettings = { order: [2, 1, 1], rotations: {}, header: '', footer: '', watermark: '', batesStart: null };
    const bytes = await exportPdf({ id: 'plan', name: 'plan.pdf', data, size: data.byteLength, modifiedAt: 0 }, [], settings);
    const result = await PDFDocument.load(bytes);
    expect(result.getTitle()).toBe('Preserve me');
    expect(result.getPage(0).getWidth()).toBe(400);
    expect(result.getForm().getFields()).toHaveLength(2);
    expect(result.getForm().getTextField('Customer').getText()).toBe('Ada');
    expect(result.catalog.has(PDFName.of('Names'))).toBe(true);
    const bookmark = result.catalog.lookup(PDFName.of('Outlines'), PDFDict).lookup(PDFName.of('First'), PDFDict);
    expect(bookmark.lookup(PDFName.of('Dest'), PDFArray).get(0)).toBe(result.getPage(1).ref);
  });
});
