import type { StyleKind, TextFormat, TextObject } from '../types';
import { textFormat } from './editingLibrary';
import { catalogFont, standardFamilies } from './fontNames';

export type TextCase = 'upper' | 'lower' | 'title' | 'sentence';

export function changeTextCase(text: string, mode: TextCase): string {
  if (mode === 'upper') return text.toUpperCase();
  if (mode === 'lower') return text.toLowerCase();
  const lower = text.toLowerCase();
  if (mode === 'title') {
    return lower.replace(
      /\p{L}[\p{L}\p{M}\p{N}'’]*/gu,
      (word) => word[0].toUpperCase() + word.slice(1),
    );
  }
  return lower.replace(
    /(^|[.!?]["'”’)\]]*\s+|\n\s*)([^\p{L}]*)(\p{L})/gu,
    (_, prefix: string, punctuation: string, letter: string) =>
      prefix + punctuation + letter.toUpperCase(),
  );
}

export function copiedTextFormat(
  object: TextObject,
  kind: StyleKind = 'paragraph',
): TextFormat & { fallback: boolean } {
  const family = object.fontFamily ?? 'Helvetica';
  const face = object.fontFace;
  const hasMatchingFace =
    face?.family === family &&
    face.bold === Boolean(object.bold) &&
    face.italic === Boolean(object.italic);
  if (
    !hasMatchingFace &&
    !catalogFont(family) &&
    !standardFamilies.some((font) => font === family)
  ) {
    throw new Error(
      'Choose a bundled font or import the matching font before copying this source formatting.',
    );
  }
  return { ...textFormat(object, kind), fontFace: object.fontFace, fallback: false };
}

export function textStatistics(text: string) {
  return { words: text.match(/\S+/gu)?.length ?? 0, characters: Array.from(text).length };
}
