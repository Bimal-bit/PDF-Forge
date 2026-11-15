import { describe, expect, it } from 'vitest';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { paragraphAt } from './paragraphs';
import { standardFontName, wrapText } from './textLayout';

describe('formatted text and paragraph reflow', () => {
  it('wraps paragraphs and long words within a bounded width', () => {
    expect(wrapText('alpha beta\nlongword', 5, (value) => value.length)).toEqual(['alpha', 'beta', 'longw', 'ord']);
  });
  it('selects actual bold and italic font variants', () => {
    expect(standardFontName({ id: 't', type: 'text', page: 1, x: 0, y: 0, text: 'Test', fontSize: 12, color: '#000000', fontFamily: 'Times-Roman', bold: true, italic: true })).toBe('Times-BoldItalic');
  });
  it('groups adjacent lines into a paragraph and keeps distant columns separate', () => {
    const item = (str: string, x: number, y: number) => ({ str, transform: [12, 0, 0, 12, x, y], width: 80, height: 12, fontName: 'f1' }) as TextItem;
    const block = paragraphAt([item('First line', 20, 200), item('Second line', 20, 184), item('Other column', 300, 200)], 0);
    expect(block.text).toBe('First line\nSecond line');
    expect(block.width).toBe(84);
  });
});
