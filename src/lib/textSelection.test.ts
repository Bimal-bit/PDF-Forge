import { describe, expect, it } from 'vitest';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { TextObject } from '../types';
import { pageSelectionTargets, selectionText } from './textSelection';
import { selectedTargets } from './textSelectionDom';

const source = (str: string, x: number, y: number): TextItem => ({
  str,
  width: str.length * 8,
  height: 16,
  transform: [16, 0, 0, 16, x, y],
  fontName: 'F1',
  dir: 'ltr',
  hasEOL: false,
});

describe('document text selection', () => {
  it('copies current text in reading order and excludes covered source runs', () => {
    const replacement: TextObject = {
      id: 'edit',
      type: 'text',
      page: 1,
      x: 30,
      y: 295,
      width: 100,
      cover: { width: 100, height: 24 },
      fontSize: 16,
      text: 'Current',
      color: '#000000',
    };
    const targets = pageSelectionTargets(
      1,
      [source('Original', 30, 300), source('Next line', 30, 200)],
      [replacement],
      [1],
    );
    expect(selectionText(targets)).toBe('Current\nNext line');
    expect(targets.map((target) => target.text)).not.toContain('Original');
  });

  it('keeps adjacent painted words together and separates lines and pages', () => {
    const first = pageSelectionTargets(
      1,
      [source('Left', 30, 300), source('Right', 70, 300), source('Next', 30, 270)],
      [],
      [1],
    );
    const second = pageSelectionTargets(2, [source('Second page', 30, 300)], [], [1, 2]);
    expect(selectionText([...first, ...second])).toBe('Left Right\nNext\nSecond page');
    expect(
      selectionText([
        { ...first[0], displayPage: 1 },
        { ...first[0], displayPage: 2 },
      ]),
    ).toBe('Left\nLeft');
  });

  it('selects only visible frame lines at their laid-out positions', () => {
    const frame: TextObject = {
      id: 'frame',
      type: 'text',
      page: 1,
      x: 30,
      y: 100,
      width: 160,
      height: 60,
      columns: 2,
      fontSize: 12,
      text: 'One two three four five six seven eight nine ten',
      color: '#000000',
    };
    const targets = pageSelectionTargets(1, [], [frame], [1]);
    expect(targets.length).toBeGreaterThan(1);
    expect(new Set(targets.map((target) => target.object?.id))).toEqual(new Set(['frame']));
    expect(targets.every((target) => target.frameLine && target.x >= 30 && target.y > 100)).toBe(
      true,
    );
  });

  it('clips copied text at native range boundaries without selecting a zero-length neighboring run', () => {
    const first = document.createElement('span'),
      second = document.createElement('span');
    first.textContent = 'First line';
    second.textContent = 'Next line';
    document.body.append(first, second);
    const range = document.createRange();
    range.setStart(first.firstChild!, 2);
    range.setEnd(second.firstChild!, 0);
    const targets = pageSelectionTargets(
      1,
      [source('First line', 30, 300), source('Next line', 30, 270)],
      [],
      [1],
    ).map((target, index) => ({ ...target, element: index ? second : first }));
    expect(selectedTargets(targets, range).map((target) => target.text)).toEqual(['rst line']);
    first.remove();
    second.remove();
  });
});
