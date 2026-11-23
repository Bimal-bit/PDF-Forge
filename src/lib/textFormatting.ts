import type { EditorObject, TextFormat, TextObject } from '../types';

export type FormatPatch = Partial<TextFormat> & { fallback?: boolean; width?: number };
export const formatBounds = {
  fontSize: [6, 144],
  lineHeight: [0.8, 4],
  letterSpacing: [-2, 20],
  indent: [0, 200],
  width: [20, 2000],
} as const;

export function nativeSourceText(object: TextObject, objects: EditorObject[]): boolean {
  return Boolean(
    object.sourceLayout &&
    !object.nextTextId &&
    (object.columns ?? 1) === 1 &&
    !object.dropCapLines &&
    !objects.some((entry) => entry.type === 'text' && entry.nextTextId === object.id),
  );
}

export function supportedFormat(
  object: TextObject,
  patch: FormatPatch,
  objects: EditorObject[],
): FormatPatch {
  const result = { ...patch };
  for (const key of Object.keys(formatBounds) as (keyof typeof formatBounds)[]) {
    const value = result[key];
    if (value === undefined) continue;
    const [min, max] = formatBounds[key];
    const fallback = object[key];
    result[key] = Math.max(
      min,
      Math.min(max, Number.isFinite(value) ? value : Number.isFinite(fallback) ? fallback! : min),
    );
  }
  if (nativeSourceText(object, objects)) {
    delete result.width;
    result.alignment = 'left';
    result.list = 'none';
    result.indent = 0;
  }
  return result;
}
