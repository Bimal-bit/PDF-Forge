import { describe, expect, it } from 'vitest';
import { annotationsFromXfdf, annotationsToXfdf } from './xfdf';

describe('XFDF annotations', () => {
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
