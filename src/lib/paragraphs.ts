import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export function paragraphAt(items: TextItem[], selected: number) {
  const target = items[selected];
  const size = Math.max(1, target.height);
  const compatible = items.map((item, index) => ({ item, index })).filter(({ item }) =>
    item.fontName === target.fontName && Math.abs(item.height - size) <= .01 && Math.abs(item.transform[1]) < .01);
  let lines: { y: number; items: typeof compatible }[] = [];
  for (const entry of compatible) {
    let line = lines.find((candidate) => Math.abs(candidate.y - entry.item.transform[5]) < size * .35 && candidate.items.some(({ item }) =>
      Math.abs(item.transform[4] + item.width - entry.item.transform[4]) < size * 3 || Math.abs(entry.item.transform[4] + entry.item.width - item.transform[4]) < size * 3));
    if (!line) { line = { y: entry.item.transform[5], items: [] }; lines.push(line); }
    line.items.push(entry);
  }
  const targetLine = lines.find((line) => line.items.some((entry) => entry.index === selected));
  const targetLeft = Math.min(...(targetLine?.items.map(({ item }) => item.transform[4]) ?? [target.transform[4]]));
  lines = lines.filter((line) => Math.abs(Math.min(...line.items.map(({ item }) => item.transform[4])) - targetLeft) <= size * 2);
  lines.sort((left, right) => right.y - left.y);
  const chosen = lines.findIndex((line) => line.items.some((entry) => entry.index === selected));
  if (chosen < 0) return { text: target.str, x: target.transform[4], y: target.transform[5], width: target.width, height: size, fontSize: size };
  const leftEdge = (index: number) => Math.min(...lines[index].items.map(({ item }) => item.transform[4]));
  const connected = (left: number, right: number) => Math.abs(lines[left].y - lines[right].y) <= size * 1.8 && Math.abs(leftEdge(left) - leftEdge(right)) <= size * 2;
  let first = chosen; let last = chosen;
  while (first > 0 && connected(first - 1, first)) first -= 1;
  while (last < lines.length - 1 && connected(last, last + 1)) last += 1;
  const block = lines.slice(first, last + 1);
  const runs = block.flatMap((line) => line.items.map(({ item }) => item));
  const x = Math.min(...runs.map((item) => item.transform[4]));
  const y = Math.min(...runs.map((item) => item.transform[5])) - size * .2;
  return {
    text: block.map((line) => line.items.sort((a, b) => a.item.transform[4] - b.item.transform[4]).map(({ item }) => item.str).join(' ').replace(/\s+/g, ' ').trim()).join('\n'),
    x, y, width: Math.max(...runs.map((item) => item.transform[4] + item.width)) - x + 4,
    height: Math.max(...runs.map((item) => item.transform[5])) + size - y, fontSize: size,
    lineHeight: block.length > 1 ? (block[0].y - block.at(-1)!.y) / ((block.length - 1) * size) : 1.2,
  };
}
