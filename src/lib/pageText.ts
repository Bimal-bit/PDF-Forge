import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { EditorObject } from '../types';
import { layoutTextFrames, type TextFrameLayout } from './textFlow';
import { paintedTextItem } from './sourceRuns';

const sourceGroup = (split: { x: number; y: number; text: string }) =>
  JSON.stringify([split.x, split.y, split.text]);
type VisibleItem = TextItem & { sourceGroup?: string };

/** Omit source runs hidden by replacement blocks when inspecting visible text. */
export function visibleSourceItems(items: TextItem[], objects: EditorObject[]): TextItem[] {
  const splits = objects.flatMap((object) =>
    object.type === 'text' && object.sourceLayout?.splitItems
      ? [object.sourceLayout.splitItems]
      : [],
  );
  const expanded: VisibleItem[] = items.flatMap((item) => {
    const split = splits.find(
      (split) =>
        split.text === item.str &&
        Math.abs(split.x - item.transform[4]) < 0.01 &&
        Math.abs(split.y - item.transform[5]) < 0.01,
    );
    return split
      ? split.items.map((run) => ({
          ...paintedTextItem(run, item.fontName),
          sourceGroup: sourceGroup(split),
        }))
      : [item];
  });
  return expanded.filter(
    (item) =>
      !objects.some((object) => {
        if (object.type === 'text' && object.cover && object.sourceLayout) {
          const radians = ((object.cover.rotation ?? 0) * Math.PI) / 180;
          const dx = item.transform[4] - ((object.cover.x ?? object.x) - 2),
            dy = item.transform[5] - ((object.cover.y ?? object.y) - 2);
          const x = dx * Math.cos(radians) + dy * Math.sin(radians),
            y = -dx * Math.sin(radians) + dy * Math.cos(radians);
          return (
            x >= -0.01 &&
            x < object.cover.width - 0.01 &&
            y >= -0.01 &&
            y <= object.cover.height + 0.01
          );
        }
        return (
          object.type === 'text' &&
          object.cover &&
          item.transform[4] >= (object.cover.x ?? object.x) - 3 &&
          item.transform[4] <= (object.cover.x ?? object.x) + object.cover.width &&
          item.transform[5] >= (object.cover.y ?? object.y) - 3 &&
          item.transform[5] <= (object.cover.y ?? object.y) + object.cover.height
        );
      }),
  );
}

export function editedPageText(
  items: TextItem[],
  objects: EditorObject[],
  layouts: Map<string, TextFrameLayout> = layoutTextFrames(objects),
): string {
  const segments: { text: string; y: number; x: number; group?: string }[] = visibleSourceItems(
    items,
    objects,
  ).map((item) => ({
    text: item.str,
    y: item.transform[5],
    x: item.transform[4],
    group: (item as VisibleItem).sourceGroup,
  }));
  for (const object of objects) {
    if (object.type === 'text')
      segments.push({
        text: layouts.get(object.id)?.visibleText ?? object.text,
        x: object.x,
        y:
          object.y +
          (object.sourceLayout?.baselineOffset ?? object.height ?? object.cover?.height ?? 0),
        group: object.sourceLayout?.splitItems
          ? sourceGroup(object.sourceLayout.splitItems)
          : undefined,
      });
    if (object.type === 'form')
      segments.push({
        text: object.kind === 'checkbox' ? (object.checked ? '[x]' : '[ ]') : object.value,
        x: object.x,
        y: object.y,
      });
    if (object.type === 'table')
      segments.push({
        text: object.cells.map((row) => row.join('\t')).join('\n'),
        x: object.x,
        y: object.y,
      });
    if (object.type === 'link') segments.push({ text: object.label, x: object.x, y: object.y });
    if (object.type === 'shape' && object.label)
      segments.push({ text: object.label, x: object.x, y: object.y + object.height / 2 });
    if (object.type === 'equation') segments.push({ text: object.latex, x: object.x, y: object.y });
  }
  const ordered = segments.sort((left, right) =>
    Math.abs(left.y - right.y) > 3 ? right.y - left.y : left.x - right.x,
  );
  return ordered
    .map(
      (segment, index) =>
        `${index && !(segment.group && segment.group === ordered[index - 1].group && Math.abs(segment.y-ordered[index-1].y)<=3) ? '\n' : ''}${segment.text}`,
    )
    .join('');
}
