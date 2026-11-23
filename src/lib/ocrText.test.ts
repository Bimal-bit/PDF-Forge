import { describe, expect, it } from 'vitest';
import { editableOcrObjects, type OcrLine } from './ocrText';
import { blankDocument } from './openDocument';
import { PDFDocument } from 'pdf-lib';
import { useAppStore } from '../store/useAppStore';

const line: OcrLine = { id: 'line', page: 2, text: 'Invoice total', confidence: 90, x: 60, y: 300, width: 150, height: 18 };
describe('editable OCR', () => {
  it('fits corrected text to its detected line and covers the original scan ink', () => {
    const object = editableOcrObjects([line], (text) => text.length * 0.5)[0];
    expect(object).toMatchObject({ type: 'text', page: 2, text: 'Invoice total', fontFamily: 'Noto Sans', x: 60, cover: { x: 60, y: 300, width: 154, height: 22 } });
    expect(object.fontSize * line.text.length * 0.5).toBeLessThanOrEqual(line.width);
    expect(editableOcrObjects([{ ...line, text: '   ' }], () => 1)).toEqual([]);
  });
  it('applies OCR in one reversible transaction with the exported display page plan', () => {
    const original = { id: 'original', name: 'scan.pdf', size: 0, modifiedAt: 0, data: new ArrayBuffer(0) };
    useAppStore.getState().setDocument(original);
    useAppStore.getState().initializePages(3);
    useAppStore.getState().setSelectedPage(2);
    useAppStore.getState().rotatePage();
    const previous = useAppStore.getState();
    const output = { ...original, id: 'recognized' };
    useAppStore.getState().applyOcrDocument(output, editableOcrObjects([line], () => 5), 3, 2);
    expect(useAppStore.getState()).toMatchObject({ selectedPage: 2, selectedObjectId: 'line', objects: [{ id: 'line' }], pageSettings: { order: [1, 2, 3], rotations: {} } });
    useAppStore.getState().undo();
    expect(useAppStore.getState().document).toEqual(previous.document);
    expect(useAppStore.getState().pageSettings).toEqual(previous.pageSettings);
    useAppStore.getState().redo();
    expect(useAppStore.getState().objects[0].id).toBe('line');
  });
  it('creates an actual blank A4 document', async () => {
    const document = await blankDocument();
    const pdf = await PDFDocument.load(document.data);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89);
  });
});
