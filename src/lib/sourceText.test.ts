import { describe, expect, it } from 'vitest';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { sourceTextObject } from './sourceText';

const page = {
  pageNumber: 1,
  commonObjs: {
    has: () => true,
    get: () => ({ name: 'Times-BoldItalic', bold: true, italic: true }),
  },
} as unknown as PDFPageProxy;
const run = (str: string, x: number, y: number, fontName = 'f1', height = 12): TextItem => ({
  str,
  dir: 'ltr',
  width: 40,
  height,
  fontName,
  transform: [height, 0, 0, height, x, y],
  hasEOL: false,
});

describe('source click editing', () => {
  it('retains each source run without merging neighboring text', () => {
    const block = sourceTextObject(
      page,
      [run('Line one', 30, 300), run('Line two', 30, 282)],
      0,
      {},
      [],
    );
    expect(block).toMatchObject({
      text: 'Line one',
      sourceText: 'Line one',
      fontFamily: 'Times-Roman',
      fontSize: 12,
      bold: true,
      italic: true,
      sourceLayout:{horizontalScale:1,rotation:0},
    });
    expect(block?.sourceLayout?.baselineOffset).toBeCloseTo(2.4);
  });

  it('isolates a run so its cover cannot erase mixed-format neighbors', () => {
    const items = [
      run('Regular', 30, 300),
      run('Bold', 70, 300, 'bold'),
      run('Regular again', 110, 300),
    ];
    const block = sourceTextObject(page, items, 0, {}, [])!;
    expect(block.text).toBe('Regular');
    expect(block.cover!.x! - 2).toBe(30);
    expect(block.cover!.x! - 2 + block.cover!.width).toBe(70);
  });

  it('keeps different source sizes separate and ignores covered or blank runs', () => {
    const items = [run('Small', 30, 300), run('Large', 70, 300, 'f1', 14), run(' ', 30, 100)];
    const block = sourceTextObject(page, items, 0, {}, [])!;
    expect(block.text).toBe('Small');
    expect(block.fontSize).toBe(12);
    expect(sourceTextObject(page, items, 0, {}, [block])).toBeUndefined();
    expect(sourceTextObject(page, items, 2, {}, [])).toBeUndefined();
  });
});
