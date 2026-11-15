import { StandardFontEmbedder } from 'pdf-lib';
import type { EditorObject, TextObject } from '../types';
import { standardFontName } from './textLayout';

export interface FlowLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  width: number;
  available: number;
  paragraphEnd: boolean;
}
export interface TextFrameLayout {
  lines: FlowLine[];
  width: number;
  height: number;
  visibleText: string;
  overflow: string;
  storyId: string;
}

const metrics = new Map<string, StandardFontEmbedder>();

function flowFont(object: TextObject) {
  const name = standardFontName(object);
  let font = metrics.get(name);
  // Both enums contain the same PDF standard-font names.
  if (!font) {
    font = StandardFontEmbedder.for(
      name as unknown as Parameters<typeof StandardFontEmbedder.for>[0],
    );
    metrics.set(name, font);
  }
  return font;
}

export function measureFlowText(object: TextObject, text: string, size = object.fontSize): number {
  const font = flowFont(object);
  // PDF text runs advance by glyph widths without automatic kerning.
  const width = Array.from(text).reduce((sum, character) => {
    try {
      return sum + font.widthOfTextAtSize(character, size);
    } catch {
      return sum + size * 0.6;
    }
  }, 0);
  return width + Math.max(0, Array.from(text).length - 1) * (object.letterSpacing ?? 0);
}

function takeLine(text: string, width: number, measure: (text: string) => number) {
  const leadingSpaces = /^ */.exec(text)![0].length;
  const content = text.slice(leadingSpaces);
  let end = 0;
  let space = -1;
  for (const character of content) {
    if (character === '\n')
      return {
        text: content.slice(0, end).trimEnd(),
        consumed: leadingSpaces + end + 1,
        paragraphEnd: true,
      };
    if (!end && measure(character) > width)
      return { text: '', consumed: leadingSpaces, paragraphEnd: false };
    if (end && measure(content.slice(0, end) + character) > width) {
      const boundary = space > 0 ? space + 1 : end;
      return {
        text: content.slice(0, boundary).trimEnd(),
        consumed: leadingSpaces + boundary,
        paragraphEnd: false,
      };
    }
    if (character === ' ') space = end;
    end += character.length;
  }
  return { text: content.trimEnd(), consumed: text.length, paragraphEnd: true };
}

function fillFrame(object: TextObject, content: string, rows: number) {
  const width = object.width ?? object.cover?.width ?? 300;
  const height = object.height ?? object.cover?.height ?? 160;
  const columns = object.columns ?? 1;
  const gap = Math.min(
    Math.max(0, object.columnGap ?? 18),
    Math.max(0, (width - columns) / Math.max(1, columns - 1)),
  );
  const columnWidth = Math.max(1, (width - gap * (columns - 1)) / columns);
  const size = object.fontSize;
  const leading = size * (object.lineHeight ?? 1.2);
  const capRows = object.dropCapLines ?? 0;
  const capBaseline = size + Math.max(0, capRows - 1) * leading;
  const capRatio = (flowFont(object).font.CapHeight || 700) / 1000;
  const capSize = size + (Math.max(0, capRows - 1) * leading) / capRatio;
  const cap = capRows && /^\S/u.test(content) ? Array.from(content)[0] : '';
  const capWidth = cap ? measureFlowText(object, cap, capSize) + size * 0.15 : 0;
  const lines: FlowLine[] = [];
  let remaining = content;
  if (cap && (capBaseline > height || capWidth >= columnWidth)) return { lines, remaining };
  if (cap) {
    lines.push({
      text: cap,
      x: 0,
      y: capBaseline,
      fontSize: capSize,
      width: capWidth - size * 0.15,
      available: capWidth,
      paragraphEnd: true,
    });
    remaining = remaining.slice(cap.length);
  }
  for (let column = 0; column < columns && remaining; column += 1) {
    for (let row = 0; row < rows && remaining; row += 1) {
      const inset = (object.indent ?? 0) + (column === 0 && row < capRows ? capWidth : 0);
      const available = Math.max(1, columnWidth - inset);
      const line = takeLine(remaining, available, (text) => measureFlowText(object, text));
      lines.push({
        ...line,
        x: column * (columnWidth + gap) + inset,
        y: size + row * leading,
        fontSize: size,
        width: measureFlowText(object, line.text),
        available,
      });
      remaining = remaining.slice(line.consumed);
    }
  }
  return { lines, remaining };
}

export function layoutTextFrame(
  object: TextObject,
  content: string,
  storyId = object.id,
): TextFrameLayout {
  const height = object.height ?? object.cover?.height ?? 160;
  const maximumRows = Math.max(
    0,
    Math.floor((height - object.fontSize) / (object.fontSize * (object.lineHeight ?? 1.2))) + 1,
  );
  const normalized = content.replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ');
  let result = fillFrame(object, maximumRows ? normalized : '', maximumRows);
  if (!result.remaining && (object.columns ?? 1) > 1 && maximumRows > 1) {
    let lower = 1;
    let upper = maximumRows;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      const candidate = fillFrame(object, normalized, middle);
      if (candidate.remaining) lower = middle + 1;
      else upper = middle;
    }
    result = fillFrame(object, normalized, lower);
  }
  if (!maximumRows) result.remaining = normalized;
  const visibleText = normalized.slice(0, normalized.length - result.remaining.length);
  return {
    lines: result.lines,
    width: object.width ?? object.cover?.width ?? 300,
    height,
    visibleText,
    overflow: result.remaining,
    storyId,
  };
}

export function textChain(objects: EditorObject[], startId: string): TextObject[] {
  const texts = new Map(
    objects
      .filter((object): object is TextObject => object.type === 'text')
      .map((object) => [object.id, object]),
  );
  const chain: TextObject[] = [];
  const visited = new Set<string>();
  let next = texts.get(startId);
  while (next && !visited.has(next.id)) {
    chain.push(next);
    visited.add(next.id);
    next = texts.get(next.nextTextId ?? '');
  }
  return chain;
}

export function layoutTextFrames(
  objects: EditorObject[],
  order?: number[],
): Map<string, TextFrameLayout> {
  const texts = objects.filter((object): object is TextObject => object.type === 'text');
  const incoming = new Set(texts.map((object) => object.nextTextId).filter(Boolean));
  const roots = [
    ...texts.filter((object) => !incoming.has(object.id)),
    ...texts.filter((object) => incoming.has(object.id)),
  ];
  const seen = new Set<string>();
  const result = new Map<string, TextFrameLayout>();
  const pages = order?.length ? new Set(order) : undefined;
  for (const root of roots) {
    if (seen.has(root.id)) continue;
    const chain = textChain(objects, root.id).filter((object) => !seen.has(object.id));
    chain.forEach((object) => seen.add(object.id));
    if (chain.length === 1 && !root.nextTextId && (root.columns ?? 1) === 1 && !root.dropCapLines)
      continue;
    let remaining = chain
      .map((object) => object.text)
      .filter(Boolean)
      .join('\n')
      .split('\n')
      .map((line, index) =>
        root.list === 'bullet'
          ? `• ${line}`
          : root.list === 'number'
            ? `${index + 1}. ${line}`
            : line,
      )
      .join('\n');
    let last: TextFrameLayout | undefined;
    for (const object of chain.filter((frame) => !pages || pages.has(frame.page))) {
      const layout = layoutTextFrame(object, remaining, root.id);
      remaining = layout.overflow;
      layout.overflow = '';
      result.set(object.id, layout);
      last = layout;
    }
    if (last) last.overflow = remaining;
  }
  return result;
}

export function linkTextFrames(objects: EditorObject[], fromId: string, toId: string): void {
  const from = objects.find((object) => object.id === fromId);
  const to = objects.find((object) => object.id === toId);
  if (from?.type !== 'text' || to?.type !== 'text') throw new Error('Choose two text boxes.');
  if (from.nextTextId)
    throw new Error('Unlink the current continuation before choosing another box.');
  if (objects.some((object) => object.type === 'text' && object.nextTextId === to.id))
    throw new Error('This box already continues another story.');
  if (textChain(objects, to.id).some((object) => object.id === from.id))
    throw new Error('A text flow cannot link back into itself.');
  from.nextTextId = to.id;
  for (const frame of [from, to]) {
    frame.width ??= frame.cover?.width ?? 300;
    frame.height ??= frame.cover?.height ?? 160;
  }
}
