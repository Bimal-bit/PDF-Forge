import { describe, expect, it } from 'vitest';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { EditorObject } from '../types';
import { editedPageText, visibleSourceItems } from './pageText';

const items = [
  { str: 'Original', transform: [16, 0, 0, 16, 30, 300] },
  { str: 'Retained', transform: [16, 0, 0, 16, 30, 100] },
] as TextItem[];
const replacement: EditorObject = {
  id: 'replacement',
  type: 'text',
  page: 1,
  x: 30,
  y: 295,
  width: 100,
  cover: { width: 100, height: 24 },
  fontSize: 16,
  color: '#000000',
  text: 'Edited',
};

describe('visible document text', () => {
  it('excludes covered source runs and includes replacement text in reading order', () => {
    expect(visibleSourceItems(items, [replacement]).map((item) => item.str)).toEqual(['Retained']);
    expect(editedPageText(items, [replacement])).toBe('Edited\nRetained');
  });

  it('includes link labels, fields, and table cells', () => {
    const objects: EditorObject[] = [
      {
        id: 'link',
        type: 'link',
        page: 1,
        x: 10,
        y: 300,
        fontSize: 12,
        url: 'https://example.com',
        label: 'Visible link',
      },
      {
        id: 'form',
        type: 'form',
        kind: 'checkbox',
        page: 1,
        x: 10,
        y: 200,
        width: 18,
        height: 18,
        label: 'Accepted',
        value: '',
        checked: true,
      },
      {
        id: 'table',
        type: 'table',
        page: 1,
        x: 10,
        y: 100,
        width: 100,
        height: 50,
        cells: [
          ['Name', 'Score'],
          ['Ada', '10'],
        ],
      },
    ];
    expect(editedPageText([], objects)).toBe('Visible link\n[x]\nName\tScore\nAda\t10');
  });

  it('retains adjacent source fragments and reading order after font IDs change on recovery', () => {
    const source = {
      str: 'REDBLUE',
      fontName: 'g_d0_f1',
      transform: [12, 0, 0, 12, 30, 300],
      width: 70,
      height: 12,
      dir: 'ltr',
      hasEOL: false,
    } as TextItem;
    const edited: EditorObject = {
      id: 'blue',
      type: 'text',
      page: 1,
      text: 'NAVY',
      x: 60,
      y: 297.6,
      width: 40,
      height: 12,
      fontSize: 12,
      color: '#0000ff',
      cover: { x: 62, y: 299.6, width: 40, height: 12 },
      sourceLayout: {
        baselineOffset: 2.4,
        ascent: 0.8,
        horizontalScale: 1,
        rotation: 0,
        fontFamily: 'Helvetica',
        bold: false,
        italic: false,
        splitItems: {
          fontName: 'g_d8_f1',
          text: 'REDBLUE',
          x: 30,
          y: 300,
          items: [
            { text: 'RED', x: 30, y: 300, width: 30, size: 12, horizontalScale: 1, rotation: 0 },
            { text: 'BLUE', x: 60, y: 300, width: 40, size: 12, horizontalScale: 1, rotation: 0 },
          ],
        },
      },
    };
    expect(visibleSourceItems([source], [edited]).map((item) => item.str)).toEqual(['RED']);
    expect(editedPageText([source], [edited])).toBe('REDNAVY');
    expect(editedPageText([source],[{...edited,y:100}])).toBe('RED\nNAVY');
  });
});
