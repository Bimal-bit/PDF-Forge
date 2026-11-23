import { expect, it } from 'vitest';
import { tableFromCsv, tableToCsv } from './tableCsv';

it('imports quoted values, duplicate/empty headers, newlines, BOM, and ragged rows as literal cells', () => {
  expect(tableFromCsv('\uFEFFName,Name,\r\n"A, B","Line 1\nLine 2","Say ""hello"""\r\nLast')).toEqual([['Name', 'Name', ''], ['A, B', 'Line 1\nLine 2', 'Say "hello"'], ['Last', '', '']]);
});
it('round-trips table values without evaluating spreadsheet formulas', () => {
  const cells = [['=SUM(A1:A2)', '+123', '@text'], ['Ω', 'a "quote"', 'line\nbreak']];
  expect(tableFromCsv(tableToCsv(cells))).toEqual(cells);
  expect(tableFromCsv(tableToCsv([[''], ['A'], ['']]))).toEqual([[''], ['A'], ['']]);
  expect(tableFromCsv('A\n\nB\n')).toEqual([['A'], [''], ['B']]);
});
it('rejects malformed and oversized tables without truncating them', () => {
  for (const value of ['"unfinished', '"done"junk']) expect(() => tableFromCsv(value)).toThrow();
  expect(() => tableFromCsv('')).toThrow('no cells');
  expect(() => tableFromCsv(Array.from({ length: 11 }, () => 'a,b').join('\n'))).toThrow('10 rows');
  expect(() => tableFromCsv('a,b,c,d,e,f,g')).toThrow('6 columns');
  expect(() => tableFromCsv('x'.repeat(2001))).toThrow('2000 characters');
});
