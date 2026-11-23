import { expect, it } from 'vitest';
import type { EditorObject, ShapeObject, TextObject } from '../types';
import { canManageObject, objectSize, positionedCopy } from './objectTools';

const bounds = { x: 40, y: 60, width: 300, height: 500, rotation: 90 };
const shape: ShapeObject = { id: 'shape', type: 'shape', page: 2, x: 190, y: 70, width: 140, height: 80, color: '#123456' };
it('duplicates inside crop bounds with an independent id and independent nested values', () => {
  const copy = positionedCopy(shape, bounds);
  expect(copy).toMatchObject({ page: 2, x: 200, y: 60, width: 140, height: 80, color: '#123456' });
  expect(copy.id).not.toBe(shape.id); expect(shape.x).toBe(190);
  const table = { ...shape, type: 'table' as const, cells: [['A', 'B']] };
  const tableCopy = positionedCopy(table, bounds);
  expect(tableCopy.type).toBe('table'); if (tableCopy.type === 'table') expect(tableCopy.cells).not.toBe(table.cells);
  expect(() => positionedCopy({ ...shape, width: 301 }, bounds)).toThrow('inside the page');
});
it('excludes source edits, existing fields, and linked stories from overlay tools', () => {
  const text: TextObject = { id: 'text', type: 'text', page: 1, x: 30, y: 50, width: 100, text: 'Hello', fontSize: 14, color: '#000000' };
  expect(canManageObject(text, [text])).toBe(true);
  for (const object of [{ ...text, cover: { width: 100, height: 20 } }, { ...text, sourceText: 'Hello' }, { ...text, nextTextId: 'next' }, { ...text, columns: 2 as const }]) expect(canManageObject(object, [object])).toBe(false);
  const incoming: EditorObject = { ...text, id: 'incoming', nextTextId: text.id };
  expect(canManageObject(text, [incoming, text])).toBe(false);
  expect(canManageObject({ ...shape, type: 'form', kind: 'text', label: 'Field', value: '', existingName: 'original' }, [])).toBe(false);
});
it('measures wrapped paragraphs and equations using the preview/writer layout', () => {
  const text: TextObject = { id: 'text', type: 'text', page: 1, x: 0, y: 0, width: 70, text: 'One two three four five', fontSize: 14, color: '#000000' };
  expect(objectSize(text).height).toBeGreaterThan(20);
  const equation = objectSize({ id: 'math', type: 'equation', page: 1, x: 0, y: 0, fontSize: 24, color: '#000000', latex: '\\frac{a}{b}' });
  expect(equation.height).toBeGreaterThan(24); expect(equation.width).toBeGreaterThan(0);
});
