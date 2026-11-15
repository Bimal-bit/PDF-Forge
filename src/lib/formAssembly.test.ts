import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { OpenDocument } from '../types';
import { exportPdf, mergePdfs } from './export';

async function document(pdf: PDFDocument): Promise<OpenDocument> {
  const bytes = await pdf.save();
  return { id: 'assembly', name: 'forms.pdf', size: bytes.byteLength, modifiedAt: 0, data: bytes.buffer as ArrayBuffer };
}

describe('form assembly', () => {
  it('registers a shared field once and retains its widgets on both merged pages', async () => {
    const source = await PDFDocument.create();
    const first = source.addPage(); const second = source.addPage();
    const field = source.getForm().createTextField('Account.Customer');
    field.setText('Ada');
    for (const page of [first, second]) field.addToPage(page, { x: 20, y: 200, width: 150, height: 24 });
    const input = await document(source);
    const merged = await PDFDocument.load(await mergePdfs([input, input]));
    const fields = merged.getForm().getFields();
    expect(fields.map((entry) => entry.getName())).toEqual(['Account.Customer', 'Account_2.Customer']);
    for (const [index, entry] of fields.entries()) {
      const widgets = entry.acroField.getWidgets();
      expect(widgets).toHaveLength(2);
      expect(widgets.map((widget) => widget.P())).toEqual([merged.getPage(index * 2).ref, merged.getPage(index * 2 + 1).ref]);
    }
    merged.getForm().getTextField('Account_2.Customer').setText('Grace');
    expect(merged.getForm().getTextField('Account.Customer').getText()).toBe('Ada');
  });

  it('avoids name collisions with existing form trees when duplicating pages', async () => {
    const source = await PDFDocument.create();
    const page = source.addPage();
    for (const name of ['Customer', 'Customer_copy_2']) {
      const field = source.getForm().createCheckBox(name);
      field.check(); field.addToPage(page, { x: 20, y: 200, width: 18, height: 18 });
    }
    const pdf = await PDFDocument.load(await exportPdf(await document(source), [], { order: [1, 1], rotations: {}, header: '', footer: '', watermark: '', batesStart: null }));
    const fields = pdf.getForm().getFields();
    expect(fields).toHaveLength(4);
    expect(new Set(fields.map((field) => field.getName())).size).toBe(4);
    expect(fields.every((field) => pdf.getForm().getCheckBox(field.getName()).isChecked())).toBe(true);
  });
});
