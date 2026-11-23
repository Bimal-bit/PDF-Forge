import { describe, expect, it } from 'vitest';
import type { TextObject } from '../types';
import { nativeSourceText, supportedFormat } from './textFormatting';

const text: TextObject = {
  id: 't',
  type: 'text',
  page: 1,
  text: 'Sample',
  x: 30,
  y: 100,
  fontSize: 16,
  color: '#123456',
};
const source: TextObject = {
  ...text,
  sourceLayout: {
    baselineOffset: 3,
    ascent: 0.8,
    horizontalScale: 1,
    rotation: 0,
    fontFamily: 'Helvetica',
    bold: false,
    italic: false,
  },
};

describe('supported Home formatting', () => {
  it('bounds saved numeric formatting and repairs nonfinite legacy values', () => {
    expect(
      supportedFormat(
        text,
        { fontSize: 999, lineHeight: -5, letterSpacing: 100, indent: -1, width: 10000 },
        [text],
      ),
    ).toMatchObject({ fontSize: 144, lineHeight: 0.8, letterSpacing: 20, indent: 0, width: 2000 });
    expect(
      supportedFormat({ ...text, fontSize: Infinity }, { fontSize: NaN, lineHeight: Infinity }, [
        text,
      ]),
    ).toMatchObject({ fontSize: 6, lineHeight: 0.8 });
  });
  it('retains source placement when a paragraph preset supplies unsupported layout properties', () => {
    const patch = supportedFormat(
      source,
      { bold: true, width: 300, list: 'number', indent: 20, alignment: 'right' },
      [source],
    );
    expect(patch).toEqual({ bold: true, list: 'none', indent: 0, alignment: 'left' });
    expect(nativeSourceText(source, [source])).toBe(true);
  });
  it('allows paragraph layout on source text converted into linked frames', () => {
    const root = { ...source, nextTextId: 'continuation' },
      continuation = { ...source, id: 'continuation' };
    const objects = [root, continuation];
    expect(nativeSourceText(continuation, objects)).toBe(false);
    expect(
      supportedFormat(
        continuation,
        { alignment: 'right', width: 300, list: 'bullet', indent: 20 },
        objects,
      ),
    ).toEqual({ alignment: 'right', width: 300, list: 'bullet', indent: 20 });
  });
});
