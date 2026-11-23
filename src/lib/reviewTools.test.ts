import { beforeEach, expect, it } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFString, decodePDFRawStream } from 'pdf-lib';
import { annotationBox, validateAnnotation } from './annotations';
import { annotationsFromXfdf, annotationsToXfdf } from './xfdf';
import { exportPdf } from './export';
import { useAppStore } from '../store/useAppStore';
import type { HighlightAnnotation, TextObject } from '../types';

const highlight: HighlightAnnotation = { id: 'mark', type: 'highlight', page: 1, x: 40, y: 60, width: 100, height: 20, color: '#0088cc', author: 'Zoë Ω', comment: 'Résumé & <review>', resolved: true };
const text = (id: string, nextTextId?: string): TextObject => ({ id, type: 'text', page: 1, x: 30, y: 30, width: 150, height: 160, text: id, fontSize: 12, color: '#000000', nextTextId });

it('validates visible annotation bounds, colors, and signed measurement endpoints', () => {
  validateAnnotation(highlight, { x: 20, y: 30, width: 200, height: 300, rotation: 90 });
  expect(() => validateAnnotation({ ...highlight, x: 0 }, { x: 20, y: 30, width: 200, height: 300, rotation: 0 })).toThrow('page');
  expect(() => validateAnnotation({ ...highlight, color: 'orange' })).toThrow('color');
  const line = { id: 'line', type: 'measure' as const, page: 1, x: 200, y: 300, width: -100, height: -60, units: 'pt' as const };
  expect(annotationBox(line)).toEqual({ x: 100, y: 232, width: 100, height: 84 });
  expect(() => validateAnnotation({ ...line, width: 0, height: 0 })).toThrow('endpoints');
  expect(() => validateAnnotation({ ...highlight, x: NaN })).toThrow('finite');
});

it('exports chosen highlight paint, Unicode comment metadata, and resolved state', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage([300, 400]); const bytes = await pdf.save();
  const output = await PDFDocument.load(await exportPdf({ id: 'review', name: 'review.pdf', size: bytes.length, modifiedAt: 0, data: bytes.slice().buffer }, [highlight]));
  const mark = output.getPage(0).node.Annots()!.lookup(0, PDFDict);
  expect(mark.lookup(PDFName.of('C'), PDFArray).asArray().map(String)).toEqual(['0', String(136 / 255), '0.8']);
  expect(mark.lookup(PDFName.of('Contents'), PDFHexString).decodeText()).toBe(highlight.comment);
  expect(mark.lookup(PDFName.of('T'), PDFHexString).decodeText()).toBe(highlight.author);
  expect(mark.lookup(PDFName.of('State'), PDFString).decodeText()).toBe('Completed');
  const appearance = mark.lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N'));
  if (!(appearance instanceof PDFRawStream)) throw new Error('Missing annotation appearance.');
  expect(new TextDecoder().decode(decodePDFRawStream(appearance).decode())).toContain(`0 ${136 / 255} 0.8 rg`);
});

it('retains measurement directions in PDF appearance streams and gives vertical lines nonzero bounds', async () => {
  const source = await PDFDocument.create(); source.addPage([500, 650]); const bytes = await source.save();
  for (const [width, height] of [[100, -60], [-100, 60], [-100, -60], [0, 80]]) {
    const line = { id: 'line', type: 'measure' as const, page: 1, x: 200, y: 300, width, height, units: 'pt' as const };
    const pdf = await PDFDocument.load(await exportPdf({ id: 'line', name: 'line.pdf', size: bytes.length, modifiedAt: 0, data: bytes.slice().buffer }, [line]));
    const mark = pdf.getPage(0).node.Annots()!.lookup(0, PDFDict);
    const rectangle = mark.lookup(PDFName.of('Rect'), PDFArray).asArray().map((entry) => Number(String(entry)));
    expect(rectangle[2]).toBeGreaterThan(rectangle[0]);
    const appearance = mark.lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N'));
    if (!(appearance instanceof PDFRawStream)) throw new Error('Missing measurement appearance.');
    const stream = new TextDecoder().decode(decodePDFRawStream(appearance).decode());
    if (width === 100 && height === -60) expect(stream).toContain('0 68 m 100 8 l');
    if (width === -100 && height === 60) expect(stream).toContain('100 8 m 0 68 l');
    if (width === -100 && height === -60) expect(stream).toContain('100 68 m 0 8 l');
    if (width === 0) expect(stream).toContain('0 8 m 0 88 l');
  }
});

it('round-trips XML comments and statuses and rejects invalid mark values', () => {
  expect(annotationsFromXfdf(annotationsToXfdf([highlight]))).toEqual([highlight]);
  const legacy = annotationsFromXfdf('<xfdf><annots><note page="1" x="20" y="30">Legacy</note></annots></xfdf>')[0];
  expect('resolved' in legacy).toBe(false);
  for (const extra of ['resolved="yes"', 'page="0"']) expect(() => annotationsFromXfdf(`<xfdf><annots><note x="20" y="30" ${extra === 'page="0"' ? extra : `page="1" ${extra}`}>Bad</note></annots></xfdf>`)).toThrow();
  expect(() => annotationsFromXfdf('<xfdf><annots><highlight page="1" x="20" y="30" color="bad"/></annots></xfdf>')).toThrow('color');
  expect(() => annotationsFromXfdf(' '.repeat(1024 * 1024 + 1))).toThrow('1 MB');
});

beforeEach(() => {
  useAppStore.getState().setDocument({ id: 'review', name: 'review.pdf', data: new ArrayBuffer(0), size: 0, modifiedAt: 0 });
  useAppStore.getState().initializePages(2);
  useAppStore.getState().setReviewOptions({ trackChanges: false, changeAuthor: 'Ava' });
});
it('accepts and rejects filtered batches with one undo step and preserves unrelated pending records', () => {
  const store = useAppStore.getState(); store.addObject(text('a')); store.addObject(text('b')); store.addObject(text('c'));
  store.setReviewOptions({ trackChanges: true });
  for (const id of ['a', 'b', 'c']) store.updateTextObject(id, `Changed ${id}`);
  const before = useAppStore.getState(), selected = before.textChanges.slice(0, 2).map((change) => change.id);
  before.reviewTextChanges(selected, true); expect(useAppStore.getState().history.length).toBe(before.history.length + 1);
  expect(useAppStore.getState().textChanges.map((change) => change.status)).toEqual(['accepted', 'accepted', 'pending']);
  store.undo(); expect(useAppStore.getState().textChanges).toEqual(before.textChanges);
  store.reviewTextChanges(selected, false); expect(useAppStore.getState().objects.filter((object) => object.type === 'text').map((object) => object.text)).toEqual(['a', 'b', 'Changed c']);
  store.undo(); expect(useAppStore.getState().objects).toEqual(before.objects); store.redo(); expect(useAppStore.getState().textChanges[0].status).toBe('rejected');
});
it('rejects adjacent inserted story frames without breaking surviving links and clears removed selection', () => {
  const store = useAppStore.getState(); store.addObject(text('a', 'b')); store.addObject(text('d'));
  store.setReviewOptions({ trackChanges: true }); store.addObject(text('b', 'c')); store.addObject(text('c', 'd'));
  const before = useAppStore.getState(); before.reviewTextChanges(before.textChanges.map((change) => change.id).reverse(), false);
  expect(useAppStore.getState().objects.map((object) => object.id)).toEqual(['a', 'd']);
  expect(useAppStore.getState().objects[0]).toMatchObject({ nextTextId: 'd' }); expect(useAppStore.getState().selectedObjectId).toBeUndefined();
  store.undo(); expect(useAppStore.getState().objects).toEqual(before.objects);
});
it('leaves history untouched when a review decision has no eligible pending records', () => {
  const state = useAppStore.getState(), history = state.history;
  state.reviewTextChanges(['missing'], true); expect(useAppStore.getState().history).toBe(history);
});
