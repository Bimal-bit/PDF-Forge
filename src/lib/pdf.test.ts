import { describe, expect, it } from 'vitest';
import { findMatches } from './pdf';

describe('PDF text search', () => {
  it('finds every case-insensitive occurrence without overlapping results', () => {
    expect(findMatches('Forge forge FORGE', 'forge')).toEqual([0, 6, 12]);
  });

  it('does not search a blank query', () => {
    expect(findMatches('A page of text', '   ')).toEqual([]);
  });
});
