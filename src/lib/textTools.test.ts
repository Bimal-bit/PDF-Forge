import { expect, it } from 'vitest';
import { cleanText, replaceLiteral } from './textTools';

it('replaces literal punctuation and replacement dollar tokens without regex interpretation', () => {
  expect(replaceLiteral('a.b A.B a?b', 'a.b', '$& $1', false)).toEqual({ text: '$& $1 $& $1 a?b', count: 2 });
  expect(replaceLiteral('a.b A.B', 'a.b', '', true)).toEqual({ text: ' A.B', count: 1 });
  expect(replaceLiteral('x', '', 'y', false)).toEqual({ text: 'x', count: 0 });
});

it('handles Unicode, line breaks, and nonoverlapping replacements', () => {
  expect(replaceLiteral('Ωmega ωmega\nΩmega', 'ωmega', 'New', false)).toEqual({ text: 'New New\nNew', count: 3 });
  expect(replaceLiteral('aaaa', 'aa', 'b', true)).toEqual({ text: 'bb', count: 2 });
  expect(replaceLiteral('a\nb', '\n', ' ', true)).toEqual({ text: 'a b', count: 1 });
});

it('cleans only the chosen whitespace category', () => {
  const text = '  One\t  two  \r\n \t \r\n Three  ';
  expect(cleanText(text, 'spaces')).toBe(' One two \r\n \r\n Three ');
  expect(cleanText(text, 'trim')).toBe('One\t  two\n\nThree');
  expect(cleanText(text, 'empty-lines')).toBe('  One\t  two  \n Three  ');
  expect(cleanText('A\u00a0\u00a0B\nC', 'spaces')).toBe('A B\nC');
});
