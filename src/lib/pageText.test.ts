import { describe, expect, it } from 'vitest';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { EditorObject } from '../types';
import { editedPageText, visibleSourceItems } from './pageText';

const items = [
  { str: 'Original', transform: [16, 0, 0, 16, 30, 300] },
  { str: 'Retained', transform: [16, 0, 0, 16, 30, 100] },
] as TextItem[];
const replacement: EditorObject = { id: 'replacement', type: 'text', page: 1, x: 30, y: 295, width: 100, cover: { width: 100, height: 24 }, fontSize: 16, color: '#000000', text: 'Edited' };

describe('visible document text', () => {
  it('excludes covered source runs and includes replacement text in reading order', () => {
    expect(visibleSourceItems(items, [replacement]).map((item) => item.str)).toEqual(['Retained']);
    expect(editedPageText(items, [replacement])).toBe('Edited\nRetained');
  });

  it('includes link labels, fields, and table cells', () => {
    const objects: EditorObject[] = [
      { id: 'link', type: 'link', page: 1, x: 10, y: 300, fontSize: 12, url: 'https://example.com', label: 'Visible link' },
      { id: 'form', type: 'form', kind: 'checkbox', page: 1, x: 10, y: 200, width: 18, height: 18, label: 'Accepted', value: '', checked: true },
      { id: 'table', type: 'table', page: 1, x: 10, y: 100, width: 100, height: 50, cells: [['Name', 'Score'], ['Ada', '10']] },
    ];
    expect(editedPageText([], objects)).toBe('Visible link\n[x]\nName\tScore\nAda\t10');
  });
});
