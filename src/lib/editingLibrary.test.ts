import { describe, expect, it } from 'vitest';
import type { TextObject } from '../types';
import { textFormat } from './editingLibrary';

const object: TextObject = {
  id: 'source',
  type: 'text',
  page: 3,
  x: 30,
  y: 300,
  text: 'Private source text',
  fontSize: 22,
  color: '#123456',
  fontFamily: 'Courier',
  bold: true,
  alignment: 'right',
  lineHeight: 1.8,
  list: 'bullet',
  indent: 15,
  cover: { width: 200, height: 30 },
};

describe('reusable text formatting', () => {
  it('saves explicit paragraph defaults without source content or geometry', () => {
    expect(textFormat(object)).toEqual({
      fontFamily: 'Courier',
      fontSize: 22,
      color: '#123456',
      bold: true,
      italic: false,
      underline: false,
      strike: false,
      letterSpacing: 0,
      alignment: 'right',
      lineHeight: 1.8,
      list: 'bullet',
      indent: 15,
      style: 'Body',
    });
    expect(textFormat()).toMatchObject({ fontSize: 12, fontFamily: 'Helvetica', lineHeight: 1.2 });
  });

  it('character styles leave paragraph properties out of the patch', () => {
    const format = textFormat(object, 'character');
    expect(format).toMatchObject({ fontSize: 22, bold: true, color: '#123456' });
    expect(format).not.toHaveProperty('alignment');
    expect(format).not.toHaveProperty('lineHeight');
    expect(format).not.toHaveProperty('list');
    expect(format).not.toHaveProperty('indent');
  });
});
