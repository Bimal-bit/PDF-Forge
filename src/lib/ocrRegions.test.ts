import { describe, expect, it } from 'vitest';
import { OPS, type PDFPageProxy } from 'pdfjs-dist';
import { imageOcrRegions, recognitionScale } from './ocrRegions';
import { editableOcrObjects } from './ocrText';
import { ocrAppearanceKey, preservesOcrPixels } from './ocrAppearance';

describe('image-specific OCR', () => {
  it('finds image rectangles through save, transform and nested form coordinates', async () => {
    const page = { getViewport: () => ({ width: 300, height: 400, convertToViewportPoint: (x: number, y: number) => [x, 400 - y] }), getOperatorList: async () => ({ fnArray: [OPS.save, OPS.transform, OPS.paintFormXObjectBegin, OPS.paintImageXObject, OPS.paintFormXObjectEnd, OPS.restore], argsArray: [[], [1, 0, 0, 1, 20, 30], [[100, 0, 0, 40, 10, 20], null], ['image'], [], []] }) } as unknown as PDFPageProxy;
    expect(await imageOcrRegions(page)).toEqual([{ left: 30, top: 310, width: 100, height: 40 }]);
  });
  it('clips cropped image extents and avoids repeating the same region', async () => {
    const page = { getViewport: () => ({ width: 300, height: 400, convertToViewportPoint: (x: number, y: number) => [x, 400 - y] }), getOperatorList: async () => ({ fnArray: [OPS.transform, OPS.paintImageXObject, OPS.paintImageXObject], argsArray: [[400, 0, 0, 300, -50, -40], ['one'], ['two']] }) } as unknown as PDFPageProxy;
    expect(await imageOcrRegions(page)).toEqual([{ left: 0, top: 140, width: 300, height: 260 }]);
  });
  it('upsamples small images while bounding recognition canvas memory', () => {
    expect(recognitionScale({ left: 0, top: 0, width: 120, height: 24 })).toBe(6);
    const region = { left: 0, top: 0, width: 4000, height: 4000 };
    expect(recognitionScale(region) ** 2 * region.width * region.height).toBeLessThanOrEqual(12_000_001);
  });
  it('keeps original pixels until text, geometry or typography is actually changed', () => {
    const [object] = editableOcrObjects([{ id: 'line', page: 1, text: 'Original', originalText: 'Original', x: 40, y: 200, width: 120, height: 18, baseline: 202, confidence: 95, fontSize: 22, fontFamily: 'Helvetica', bold: true, color: '#b82035', background: '#fff2d9', horizontalScale: .9 }], () => 1);
    expect(preservesOcrPixels(object)).toBe(true);
    expect(preservesOcrPixels({ ...object, text: 'New wording' })).toBe(false);
    expect(preservesOcrPixels({ ...object, fontSize: 24 })).toBe(false);
    expect(preservesOcrPixels({ ...object, x: 45 })).toBe(false);
    expect(object.ocr!.appearance).toBe(ocrAppearanceKey(object));
  });
  it('fits edits using the original style and baseline rather than resizing every replacement', () => {
    const line = { id: 'line', page: 1, text: '12345', originalText: '12345', x: 40, y: 200, width: 120, height: 18, baseline: 202, confidence: 95, fontSize: 22, fontFamily: 'Helvetica', bold: true };
    const [original] = editableOcrObjects([line], () => 1), [edited] = editableOcrObjects([{ ...line, text: 'A longer new value' }], () => 20);
    expect(edited).toMatchObject({ fontSize: original.fontSize, fontFamily: original.fontFamily, bold: true, x: 40, y: 202 });
    expect(preservesOcrPixels(edited)).toBe(false);
  });
});
