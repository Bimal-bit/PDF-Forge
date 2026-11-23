import { beforeEach, describe, expect, it } from 'vitest';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import type { EditorObject, ShapeObject, TextObject } from '../types';
import { layoutTextFrame, layoutTextFrames, linkTextFrames } from './textFlow';
import { connectorPoints } from './diagrams';
import { adjustImagePixels, removeEdgeBackground } from './imageEditing';
import { equationLayout } from './equations';
import { exportPdf } from './export';
import { useAppStore } from '../store/useAppStore';

const frame = (id: string, text: string, patch: Partial<TextObject> = {}): TextObject => ({ id, type: 'text', page: 1, text, x: 30, y: 100, width: 100, height: 50, fontSize: 12, color: '#000000', ...patch });

describe('advanced text layout', () => {
  it('retains source paragraph layout until columns or a continuation explicitly enable frame flow', () => {
    const source = frame('source', 'A matched source paragraph', { cover: { width: 100, height: 50 } });
    expect(layoutTextFrames([source]).size).toBe(0);
    expect(layoutTextFrames([{ ...source, columns: 2 }]).has('source')).toBe(true);
    expect(layoutTextFrames([frame('inserted', source.text)]).has('inserted')).toBe(true);
  });
  it('wraps at the actual unkerned PDF glyph advances', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont('Helvetica');
    const width = font.widthOfTextAtSize('A', 12) + font.widthOfTextAtSize('V', 12) - .5;
    const layout = layoutTextFrame(frame('tight', 'AV', { width }), 'AV');
    expect(layout.lines.map((line) => line.text)).toEqual(['A', 'V']);
    expect(layout.overflow).toBe('');
  });
  it('balances columns, reserves drop-cap space, and keeps overflow text', () => {
    const columns = layoutTextFrame(frame('columns', 'A long paragraph for a small newsletter column with many readable words.', { width: 240, height: 160, columns: 3, dropCapLines: 2 }), 'A long paragraph for a small newsletter column with many readable words.');
    expect(columns.overflow).toBe('');
    expect(new Set(columns.lines.map((line) => Math.floor(line.x / 86))).size).toBe(3);
    expect(columns.lines[0].fontSize).toBeGreaterThan(12);
    expect(columns.lines.slice(1).every((line) => !line.text.startsWith(' '))).toBe(true);
    const small = layoutTextFrame(frame('small', 'Too much text'), 'Too much text');
    expect(small.visibleText + small.overflow).toBe('Too much text');
    const narrow = layoutTextFrame(frame('narrow', 'W', { width: 1 }), 'W');
    expect(narrow.visibleText).toBe(''); expect(narrow.overflow).toBe('W');
  });

  it('flows between pages and reflows a story when its first page is removed', () => {
    const text = 'This story flows across frames and keeps every word at the end.';
    const objects: EditorObject[] = [frame('a', text, { height: 25, nextTextId: 'b' }), frame('b', '', { page: 2, height: 160 })];
    const layouts = layoutTextFrames(objects, [1, 2]);
    expect(layouts.get('a')!.visibleText + layouts.get('b')!.visibleText).toBe(text);
    expect(layouts.get('b')!.overflow).toBe('');
    expect(layoutTextFrames(objects, [2]).get('b')!.visibleText).toBe(text);
  });

  it('rejects cyclic links and preserves individual contributions when unlinked', () => {
    const objects = [frame('a', 'First'), frame('b', 'Second')];
    linkTextFrames(objects, 'a', 'b');
    expect(() => linkTextFrames(objects, 'b', 'a')).toThrow('itself');
    expect(objects.map((object) => object.text)).toEqual(['First', 'Second']);
    delete objects[0].nextTextId;
    const independent = layoutTextFrames(objects);
    expect(independent.size).toBe(2);
    expect(independent.get('a')!.visibleText).toBe('First');
    expect(independent.get('b')!.visibleText).toBe('Second');
  });
});

describe('local image processing and diagrams', () => {
  it('retains shorthand colors from older shape records in exported PDFs', async () => {
    const source = await PDFDocument.create(); source.addPage([300, 400]);
    const bytes = await source.save();
    const document = { id: 'legacy-color', name: 'shape.pdf', size: bytes.length, modifiedAt: 0, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
    const output = await PDFDocument.load(await exportPdf(document, [{ id: 'old-shape', type: 'shape', page: 1, x: 30, y: 200, width: 100, height: 50, color: '#f00' }]));
    const streams = output.context.enumerateIndirectObjects().filter((entry): entry is [typeof entry[0], PDFRawStream] => entry[1] instanceof PDFRawStream).map(([, stream]) => new TextDecoder().decode(decodePDFRawStream(stream).decode())).join('');
    expect(streams).toContain('1 0 0 RG');
  });
  it('removes an edge-connected backdrop and retains enclosed foreground colors', () => {
    const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(255);
    for (let y = 1; y <= 3; y += 1) for (let x = 1; x <= 3; x += 1) {
      if (x === 2 && y === 2) continue;
      pixels.set([0, 0, 0, 255], (y * 5 + x) * 4);
    }
    removeEdgeBackground(pixels, 5, 5, '#ffffff', 0);
    expect(pixels[3]).toBe(0);
    expect(pixels[(2 * 5 + 2) * 4 + 3]).toBe(255);
    expect(pixels[(1 * 5 + 1) * 4 + 3]).toBe(255);
    adjustImagePixels(pixels, 10, 0);
    expect(pixels[(1 * 5 + 1) * 4]).toBe(26);
    expect(pixels[3]).toBe(0);
  });

  it('anchors connectors to shape boundaries and follows moved endpoints', () => {
    const from: ShapeObject = { id: 'a', type: 'shape', page: 1, x: 0, y: 0, width: 100, height: 50, color: '#000000', shapeKind: 'rectangle' };
    const to = { ...from, id: 'b', x: 200, shapeKind: 'diamond' as const };
    const connector = { id: 'c', type: 'connector' as const, page: 1, fromId: 'a', toId: 'b', color: '#000000', arrow: true };
    expect(connectorPoints(connector, [from, to])).toMatchObject({ start: { x: 100, y: 25 }, end: { x: 200, y: 25 } });
    expect(connectorPoints(connector, [from, { ...to, x: 300 }])!.end.x).toBe(300);
    expect(connectorPoints(connector, [from])).toBeUndefined();
  });
});

describe('vector equations', () => {
  it('lays out nested fractions, roots, Greek letters, and scripts', () => {
    const layout = equationLayout('\\frac{\\alpha_1 + x^2}{\\sqrt{y}} = \\sum_{i=1}^{n} i', 24);
    expect(layout.glyphs.map((glyph) => glyph.text).join('')).toContain('α');
    expect(layout.glyphs.some((glyph) => glyph.font === 'Symbol')).toBe(true);
    expect(layout.rules.length).toBeGreaterThan(4);
    expect(layout.ascent).toBeGreaterThan(24);
    expect(() => equationLayout('\\unknown{x}', 24)).toThrow('Unsupported');
    expect(() => equationLayout('\\frac{x}', 24)).toThrow('missing');
  });

  it('exports equation glyphs and fraction rules as vectors', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage([300, 400]);
    const bytes = await pdf.save();
    const document = { id: 'equation', name: 'math.pdf', size: bytes.length, modifiedAt: 0, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
    const output = await PDFDocument.load(await exportPdf(document, [{ id: 'math', type: 'equation', page: 1, x: 30, y: 200, latex: '\\frac{x^2}{\\pi}', fontSize: 24, color: '#000000' }]));
    const objects = output.context.enumerateIndirectObjects();
    expect(objects.map(([, value]) => value.toString()).join('')).toContain('/Symbol');
    expect(objects.map(([, value]) => value.toString()).join('')).not.toContain('/Subtype /Image');
    const streams = objects.filter((entry): entry is [typeof entry[0], PDFRawStream] => entry[1] instanceof PDFRawStream).map(([, stream]) => new TextDecoder().decode(decodePDFRawStream(stream).decode())).join('');
    expect(streams).toContain(' Tj'); expect(streams).toContain(' l');
  });
});

describe('tracked text state', () => {
  beforeEach(() => {
    useAppStore.getState().setDocument({ id: 'review', name: 'review.pdf', size: 0, modifiedAt: 0, data: new ArrayBuffer(0) });
    useAppStore.getState().setReviewOptions({ trackChanges: false, changeAuthor: 'Ava' });
    useAppStore.getState().initializePages(2);
  });

  it('coalesces block edits with authors and keeps rejection undoable', () => {
    useAppStore.getState().addObject(frame('a', 'Original'));
    useAppStore.getState().setReviewOptions({ trackChanges: true });
    useAppStore.getState().updateTextObject('a', 'First edit');
    useAppStore.getState().setReviewOptions({ changeAuthor: 'Ben' });
    useAppStore.getState().updateTextObject('a', 'Final edit');
    const change = useAppStore.getState().textChanges[0];
    expect(change).toMatchObject({ authors: ['Ava', 'Ben'], before: 'Original', after: 'Final edit', status: 'pending' });
    useAppStore.getState().reviewTextChange(change.id, false);
    expect(useAppStore.getState().objects[0]).toMatchObject({ text: 'Original' });
    useAppStore.getState().undo();
    expect(useAppStore.getState().objects[0]).toMatchObject({ text: 'Final edit' });
    expect(useAppStore.getState().textChanges[0].status).toBe('pending');
    useAppStore.getState().reviewTextChange(change.id, true);
    expect(useAppStore.getState().textChanges[0].status).toBe('accepted');
  });

  it('removes a rejected insertion and restores review data from recovery', () => {
    useAppStore.getState().setReviewOptions({ trackChanges: true });
    useAppStore.getState().addTextObject();
    const state = useAppStore.getState();
    useAppStore.getState().restoreDocument({ ...state.document!, objects: state.objects, pageSettings: state.pageSettings, trackChanges: state.trackChanges, changeAuthor: state.changeAuthor, textChanges: state.textChanges });
    useAppStore.getState().reviewTextChange(state.textChanges[0].id, false);
    expect(useAppStore.getState().objects).toEqual([]);
  });

  it('reconnects text flows and removes connectors with deleted endpoints', () => {
    const store = useAppStore.getState();
    store.addObject(frame('a', 'First', { nextTextId: 'b' })); store.addObject(frame('b', '', { nextTextId: 'c' })); store.addObject(frame('c', 'Last'));
    store.removeObject('b');
    expect(useAppStore.getState().objects[0]).toMatchObject({ nextTextId: 'c' });
    store.addObject({ id: 'shape', type: 'shape', page: 1, x: 0, y: 0, width: 100, height: 50, color: '#000000' });
    store.addObject({ id: 'connector', type: 'connector', page: 1, fromId: 'shape', toId: 'other', color: '#000000', arrow: true });
    store.removeObject('shape');
    expect(useAppStore.getState().objects.some((object) => object.id === 'connector')).toBe(false);
    store.undo();
    expect(useAppStore.getState().objects.some((object) => object.id === 'connector')).toBe(true);
  });
});
