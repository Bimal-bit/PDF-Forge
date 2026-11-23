import { describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { assertInsertFits, insertionBounds, insertionPoint, insertionSize, localDateText, normalizeLinkUrl, resizeTable, safeLinkHref } from './insertion';
import { tableLayout, type TableMetrics } from './tableLayout';
import type { TableObject } from '../types';

describe('local insertion geometry', () => {
  it('keeps objects inside offset crop bounds for every rotation and preset', () => {
    for (const rotation of [0, 90, 180, 270, -90, 450]) {
      const bounds = { x: 30, y: 50, width: 300, height: 500, rotation };
      for (const preset of ['top', 'middle', 'bottom'] as const) {
        for (let count = 0; count < 20; count++) {
          const point = insertionPoint(bounds, 140, 80, preset, count);
          expect(() => assertInsertFits(bounds, point.x, point.y, 140, 80)).not.toThrow();
        }
      }
    }
    expect(insertionPoint({ x: 30, y: 50, width: 300, height: 500, rotation: 90 }, 140, 80, 'top')).toEqual({ x: 60, y: 80 });
  });
  it('reads PDF crop offsets and native rotation', async () => {
    const pdf = await PDFDocument.create(); const page = pdf.addPage([600, 800]); page.setCropBox(50, 80, 400, 600); page.setRotation(degrees(270));
    const data = (await pdf.save()).buffer as ArrayBuffer;
    expect(await insertionBounds({ id: 'crop', name: 'crop.pdf', size: data.byteLength, data, modifiedAt: 0 }, 1)).toEqual({ x: 50, y: 80, width: 400, height: 600, rotation: 270 });
  });
  it('fits images proportionally and rejects unusable geometry', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 200, rotation: 0 };
    expect(insertionSize(bounds, 200, 100, true)).toEqual({ width: 80, height: 40 });
    expect(() => insertionPoint(bounds, 101, 20, 'top')).toThrow('does not fit');
    expect(() => assertInsertFits(bounds, 90, 0, 20, 20)).toThrow('inside');
    expect(() => assertInsertFits(bounds, NaN, 0, 20, 20)).toThrow('inside');
  });
});

it('normalizes supported links without allowing executable or local URLs', () => {
  expect(normalizeLinkUrl(' www.example.com/docs ')).toBe('https://www.example.com/docs');
  for (const url of ['https://example.com/a?b=2#c', 'http://localhost:123/a', 'mailto:team@example.com?subject=Hi', 'tel:+15551234567']) expect(normalizeLinkUrl(url)).toBe(url);
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///test', 'ftp://example.com', 'not a link', 'mailto:invalid', 'tel:abc']) expect(safeLinkHref(url)).toBeUndefined();
});

it('retains cells when resizing a table and inserts the local calendar date', () => {
  const cells = [['A', 'B'], ['C', 'D']];
  expect(resizeTable(cells, 3, 1)).toEqual([['A'], ['C'], ['']]);
  expect(cells).toEqual([['A', 'B'], ['C', 'D']]);
  expect(localDateText(new Date(2026, 0, 2, 0, 15))).toBe('2026-01-02');
});

describe('table preview and writer layout', () => {
  const metrics: TableMetrics = { family: 'test', measure: (text, size) => text.length * size * 0.5, supports: (text) => !text.includes('🚀') };
  const table: TableObject = { id: 'table', type: 'table', page: 1, x: 30, y: 50, width: 160, height: 80, headerRow: true, cells: [['Long heading wraps', 'B'], ['Two\nlines', 'D']] };
  it('wraps and positions header/body cells within the shared grid', () => {
    const layout = tableLayout(table, metrics);
    expect(layout.cells[0].lines.length).toBeGreaterThan(1);
    expect(layout.cells[0].header).toBe(true);
    expect(layout.cells[2]).toMatchObject({ x: 0, top: 40, width: 80, height: 40, header: false, lines: ['Two', 'lines'] });
    for (const cell of layout.cells) {
      expect(cell.lines.length * cell.size * 1.2).toBeLessThanOrEqual(cell.height - 8);
      expect(cell.lines.every((line) => metrics.measure(line, cell.size) <= cell.width - 10)).toBe(true);
    }
  });
  it('rejects unsupported glyphs and overflowing cell text', () => {
    expect(() => tableLayout({ ...table, cells: [['🚀']] }, metrics)).toThrow('characters unavailable');
    expect(() => tableLayout({ ...table, width: 30, height: 20, cells: [['Too much text to fit in this very small cell']] }, metrics)).toThrow('needs more space');
    expect(() => tableLayout({ ...table, cells: [['A'], ['B', 'C']] }, metrics)).toThrow('rectangular');
  });
});
