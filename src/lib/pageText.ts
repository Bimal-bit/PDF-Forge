import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { EditorObject } from '../types';
import { layoutTextFrames, type TextFrameLayout } from './textFlow';

/** Omit source runs hidden by replacement blocks when inspecting visible text. */
export function visibleSourceItems(items: TextItem[], objects: EditorObject[]): TextItem[] {
  return items.filter((item) => !objects.some((object) => object.type === 'text' && object.cover &&
    item.transform[4] >= (object.cover.x ?? object.x) - 3 && item.transform[4] <= (object.cover.x ?? object.x) + object.cover.width &&
    item.transform[5] >= (object.cover.y ?? object.y) - 3 && item.transform[5] <= (object.cover.y ?? object.y) + object.cover.height));
}

export function editedPageText(items: TextItem[], objects: EditorObject[], layouts: Map<string, TextFrameLayout> = layoutTextFrames(objects)): string {
  const segments = visibleSourceItems(items, objects).map((item) => ({ text: item.str, y: item.transform[5], x: item.transform[4] }));
  for (const object of objects) {
    if (object.type === 'text') segments.push({ text: layouts.get(object.id)?.visibleText ?? object.text, x: object.x, y: object.y + (object.height ?? object.cover?.height ?? 0) });
    if (object.type === 'form') segments.push({ text: object.kind === 'checkbox' ? object.checked ? '[x]' : '[ ]' : object.value, x: object.x, y: object.y });
    if (object.type === 'table') segments.push({ text: object.cells.map((row) => row.join('\t')).join('\n'), x: object.x, y: object.y });
    if (object.type === 'link') segments.push({ text: object.label, x: object.x, y: object.y });
    if (object.type === 'shape' && object.label) segments.push({ text: object.label, x: object.x, y: object.y + object.height / 2 });
    if (object.type === 'equation') segments.push({ text: object.latex, x: object.x, y: object.y });
  }
  return segments.sort((left, right) => Math.abs(left.y - right.y) > 3 ? right.y - left.y : left.x - right.x).map((segment) => segment.text).join('\n');
}
