import { describe, expect, it } from 'vitest';
import type { TextObject } from '../types';
import { changeTextCase, copiedTextFormat, textStatistics } from './homeText';

const text: TextObject = {
  id: 'source',
  type: 'text',
  page: 2,
  x: 40,
  y: 100,
  text: 'Keep my text',
  fontSize: 18,
  color: '#123456',
  bold: true,
  width: 200,
  columns: 2,
  cover: { width: 100, height: 20 },
};

describe('Home text commands', () => {
  it('changes Unicode text case while retaining punctuation, apostrophes, and line breaks', () => {
    expect(changeTextCase('¡HOLA, señor!\nDon’t SHOUT.', 'lower')).toBe(
      '¡hola, señor!\ndon’t shout.',
    );
    expect(changeTextCase('Café & résumé', 'upper')).toBe('CAFÉ & RÉSUMÉ');
    expect(changeTextCase("  DON'T stop\nélan vital", 'title')).toBe("  Don't Stop\nÉlan Vital");
    expect(changeTextCase('“HELLO!” NEXT sentence.\n¡OTRA LÍNEA!', 'sentence')).toBe(
      '“Hello!” Next sentence.\n¡Otra línea!',
    );
  });

  it('copies only formatting and explicitly clears a previously imported face', () => {
    const format = copiedTextFormat(text);
    expect(format).toMatchObject({
      fontSize: 18,
      bold: true,
      fontFamily: 'Helvetica',
      italic: false,
      list: 'none',
      fallback: false,
    });
    expect(format).toHaveProperty('fontFace', undefined);
    for (const key of ['id', 'page', 'text', 'x', 'y', 'width', 'cover', 'sourceLayout', 'columns'])
      expect(format).not.toHaveProperty(key);
  });

  it('requires a usable font before transferring a source-only font identity', () => {
    expect(() => copiedTextFormat({ ...text, fontFamily: 'UniqueSubsetFont' })).toThrow(
      'import the matching font',
    );
    expect(copiedTextFormat({ ...text, fontFamily: 'Inter' }).fontFamily).toBe('Inter');
    expect(() =>
      copiedTextFormat({
        ...text,
        fontFamily: 'UniqueSubsetFont',
        fontFace: {
          id: 'other',
          family: 'Different',
          name: 'Different',
          bold: false,
          italic: false,
          dataUrl: '',
        },
      }),
    ).toThrow('import the matching font');
  });

  it('counts whitespace-delimited words and Unicode code points', () => {
    expect(textStatistics('  hello\nworld 😀 ')).toEqual({ words: 3, characters: 16 });
    expect(textStatistics('')).toEqual({ words: 0, characters: 0 });
    expect(textStatistics(' \n ')).toEqual({ words: 0, characters: 3 });
  });
});
