import { describe, expect, it } from 'vitest';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextObject } from '../types';
import { hasSimilarFont, matchingPageBlocks, pdfTextAppearance } from './smartTextMatch';

const seed: TextObject = {
  id: 'seed',
  type: 'text',
  page: 1,
  text: 'Seed',
  x: 30,
  y: 300,
  fontFamily: 'Helvetica',
  fontSize: 12,
  color: '#000000',
};
const item = (text: string, x: number, y: number, fontName = 'f1', height = 12): TextItem => ({
  str: text,
  dir: 'ltr',
  width: 80,
  height,
  fontName,
  transform: [height, 0, 0, height, x, y],
  hasEOL: true,
});
const appearance = (run: TextItem) => ({
  fontFamily: run.fontName === 'f2' ? 'Courier' : 'Helvetica',
  bold: run.fontName === 'bold',
  italic: false,
});

describe('smart text matching', () => {
  it('matches supported family, emphasis, and size with a bounded tolerance', () => {
    expect(hasSimilarFont(seed, { fontFamily: 'Arial', fontSize: 12.5 })).toBe(true);
    expect(hasSimilarFont(seed, { fontFamily: 'Helvetica', fontSize: 13 })).toBe(false);
    expect(hasSimilarFont(seed, { fontFamily: 'Helvetica', fontSize: 12, bold: true })).toBe(false);
    expect(hasSimilarFont(seed, { fontFamily: 'Times-Roman', fontSize: 12 })).toBe(false);
  });

  it('groups each compatible paragraph once, keeps columns separate, and excludes covered text', () => {
    const runs = [
      item('Covered', 30, 500),
      item('Line one', 30, 300),
      item('Line two', 30, 284),
      item('Other column', 240, 300),
      item('Other font', 30, 100, 'f2'),
      item('Bold', 30, 80, 'bold'),
    ];
    const cover: TextObject = { ...seed, y: 495, cover: { width: 100, height: 20 } };
    const blocks = matchingPageBlocks(2, runs, seed, [cover], appearance);
    expect(blocks.map((block) => block.text)).toEqual(['Line one\nLine two', 'Other column']);
    expect(blocks.every((block) => block.page === 2 && block.cover?.width)).toBe(true);
  });

  it('skips blank and rotated source runs', () => {
    const rotated = { ...item('Rotated', 30, 200), transform: [0, 12, -12, 0, 30, 200] };
    expect(matchingPageBlocks(1, [item(' ', 30, 300), rotated], seed, [], appearance)).toEqual([]);
  });

  it('keeps mixed-font source content out of replacement covers', () => {
    const runs = [
      { ...item('Regular', 30, 300), width: 40 },
      { ...item('Bold', 70, 300, 'bold'), width: 30 },
      { ...item('Regular again', 100, 300), width: 50 },
    ];
    expect(matchingPageBlocks(1, runs, seed, [], appearance)).toEqual([]);
  });

  it('uses extracted family metadata when a shared font object is absent', () => {
    const page = { commonObjs: { has: () => false } } as unknown as PDFPageProxy;
    expect(
      pdfTextAppearance(page, item('Fallback', 30, 300), {
        f1: { fontFamily: 'monospace', ascent: .8, descent: -.2, vertical: false },
      }),
    ).toEqual({ fontFamily: 'Courier', fallback: true, bold: false, italic: false });
  });
});
