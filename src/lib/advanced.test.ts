import { describe, expect, it } from 'vitest';
import { comparePageText, tableFromTextItems, tablesToCsv, textToHtml } from './advanced';

describe('M9 local document tools', () => {
  it('exports escaped, page-marked table CSV', () => {
    expect(tablesToCsv([{ page: 2, rows: [['Name', 'Note'], ['Ada', 'He said "hello"']] }])).toBe('# Page 2\n"Name","Note"\n"Ada","He said ""hello"""\n');
  });
  it('only recognises a table when two rows have multiple columns', () => {
    const items = [
      { str: 'Name', transform: [1, 0, 0, 1, 10, 100] }, { str: 'Score', transform: [1, 0, 0, 1, 80, 100] },
      { str: 'Ada', transform: [1, 0, 0, 1, 10, 80] }, { str: '10', transform: [1, 0, 0, 1, 80, 80] },
    ] as never;
    expect(tableFromTextItems(1, items)?.rows).toEqual([['Name', 'Score'], ['Ada', '10']]);
  });
  it('reports local text additions and removals', () => {
    expect(comparePageText('alpha beta', 'alpha gamma', 1)).toMatchObject({ equal: false, added: ['gamma'], removed: ['beta'] });
  });
  it('escapes extracted text in standalone HTML', () => {
    expect(textToHtml(['<script>'], 'A & B')).toContain('&lt;script&gt;');
  });
});
