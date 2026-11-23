export type CleanupMode = 'spaces' | 'trim' | 'empty-lines';

export function cleanText(text: string, mode: CleanupMode): string {
  if (mode === 'spaces') return text.replace(/[^\S\r\n]+/gu, ' ');
  if (mode === 'trim')
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .join('\n');
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .join('\n');
}

export function replaceLiteral(
  text: string,
  find: string,
  replacement: string,
  matchCase: boolean,
) {
  if (!find) return { text, count: 0 };
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let count = 0;
  const result = text.replace(new RegExp(escaped, matchCase ? 'gu' : 'giu'), () => {
    count += 1;
    return replacement;
  });
  return { text: result, count };
}
