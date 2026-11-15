import { describe, expect, it } from 'vitest';
import { annotationsFromXfdf, annotationsToXfdf } from './xfdf';

describe('XFDF annotations', () => {
  it('preserves XML entities in IDs, authors, and comments without decoding twice', () => {
    const source = [{ id: 'a&"b', type: 'note' as const, page: 1, x: 0, y: 0, author: 'A & "B"', comment: 'Literal &lt;tag&gt; and <tag>' }];
    expect(annotationsFromXfdf(annotationsToXfdf(source))).toEqual(source);
  });

  it('preserves a vertical measurement with zero width', () => {
    const source = [{ id: 'vertical', type: 'measure' as const, page: 1, x: 10, y: 20, width: 0, height: 144, units: 'in' as const }];
    expect(annotationsFromXfdf(annotationsToXfdf(source))).toEqual(source);
  });

  it('rejects malformed XML and non-finite annotation geometry', () => {
    expect(() => annotationsFromXfdf('<xfdf><annots>')).toThrow();
    expect(() => annotationsFromXfdf('<xfdf><annots><measure page="1" x="0" y="0" width="Infinity" height="0"/></annots></xfdf>')).toThrow();
  });

  it('round-trips comments, stamps, highlights, and measurements locally', () => {
    const source = [
      { id: 'h', type: 'highlight' as const, page: 1, x: 12, y: 13, width: 100, height: 18, color: '#f6d365', author: 'Ava', comment: 'Check <this>' },
      { id: 'n', type: 'note' as const, page: 1, x: 20, y: 30, author: 'Ava', comment: 'Comment' },
      { id: 's', type: 'stamp' as const, page: 2, x: 30, y: 40, label: 'DRAFT' as const },
      { id: 'm', type: 'measure' as const, page: 2, x: 30, y: 40, width: 144, height: 0, units: 'in' as const },
    ];
    const parsed = annotationsFromXfdf(annotationsToXfdf(source));
    expect(parsed).toEqual(source);
  });
});
