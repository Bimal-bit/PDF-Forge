import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';
import type { EditorObject, OpenDocument, TextObject } from '../types';
import type { TextSelectionGroup } from '../store/useTextSelectionStore';
import { visibleSourceItems } from './pageText';
import { paintedTextItem, sourceRunAtPoint } from './sourceRuns';
import { sourceTextObject } from './sourceText';
import { preserveSourceFont } from './sourceFonts';
import { layoutTextFrames, measureFlowText } from './textFlow';
import { blockTextGeometry } from './textLayout';
import { sampleTextBackground } from './textBackground';
import { flowLineX } from './drawTextFlow';

export interface SelectionPage {
  page: PDFPageProxy;
  content: TextContent;
  viewport: ReturnType<PDFPageProxy['getViewport']>;
}
export interface SelectionTarget {
  key: string;
  page: number;
  displayPage?: number;
  item?: TextItem;
  object?: TextObject;
  text: string;
  x: number;
  y: number;
  size: number;
  width: number;
  background?: string;
  frameLine?: boolean;
  wordSpacing?: number;
}
export interface RenderedSelectionTarget extends SelectionTarget {
  element: HTMLElement;
}

export function pageSelectionTargets(
  page: number,
  items: TextItem[],
  objects: EditorObject[],
  order: number[] = [],
): SelectionTarget[] {
  const layouts = layoutTextFrames(objects, order);
  const sources: SelectionTarget[] = visibleSourceItems(
    items,
    objects.filter((object) => object.page === page),
  )
    .filter((item) => item.str.trim())
    .map((item) => ({
      key: JSON.stringify([page, item.fontName, item.transform[4], item.transform[5], item.str]),
      page,
      item,
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      size: item.height,
      width: item.width,
    }));
  const edits: SelectionTarget[] = objects.flatMap((object) => {
    if (object.type !== 'text' || object.page !== page) return [];
    const layout = layouts.get(object.id);
    if (layout)
      return layout.lines
        .filter((line) => line.text)
        .map((line, index) => ({
          key: `${object.id}:line:${index}`,
          page,
          object,
          text: line.text,
          x: object.x + flowLineX(object, line),
          y: object.y + layout.height - line.y,
          size: line.fontSize,
          width: line.width,
          frameLine: true,
          wordSpacing:
            object.alignment === 'justify' && !line.paragraphEnd && line.text.includes(' ')
              ? Math.max(0, line.available - line.width) / (line.text.split(' ').length - 1)
              : 0,
        }));
    if (!object.sourceLayout)
      return blockTextGeometry(object, (text) => measureFlowText(object, text))
        .lines.filter((line) => line.text)
        .map((line, index) => ({
          key: `${object.id}:line:${index}`,
          page,
          object,
          text: line.text,
          x: line.x,
          y: line.y,
          size: object.fontSize,
          width: line.width,
          frameLine: true,
          wordSpacing: line.wordSpacing,
        }));
    const text = object.text;
    return text
      ? [
          {
            key: object.id,
            page,
            object,
            text,
            x: object.x,
            y: object.y + (object.sourceLayout?.baselineOffset ?? object.height ?? 0),
            size: object.fontSize,
            width: object.width ?? 0,
          },
        ]
      : [];
  });
  return [...sources, ...edits].sort((a, b) =>
    Math.abs(a.y - b.y) > Math.min(a.size, b.size) * 0.35 ? b.y - a.y : a.x - b.x,
  );
}

export function selectionText(targets: SelectionTarget[]): string {
  return targets
    .map((target, index) => {
      const previous = targets[index - 1];
      const separator = !previous
        ? ''
        : (previous.displayPage ?? previous.page) !== (target.displayPage ?? target.page) ||
            Math.abs(previous.y - target.y) > Math.min(previous.size, target.size) * 0.35
          ? '\n'
          : /\s$/.test(previous.text) ||
              /^\s/.test(target.text) ||
              target.x - previous.x - previous.width < 1
            ? ''
            : ' ';
      return separator + target.text;
    })
    .join('');
}

export async function prepareTextSelection(
  pdf: PDFDocumentProxy,
  document: OpenDocument,
  objects: EditorObject[],
  order: number[],
  targets: SelectionTarget[],
  signal: AbortSignal,
): Promise<TextSelectionGroup | undefined> {
  const additions: TextObject[] = [];
  const ids = new Set<string>();
  const seen = new Set<string>();
  let seed: TextObject | undefined;
  let sampling:
    { page: number; canvas: HTMLCanvasElement; viewport: SelectionPage['viewport'] } | undefined;
  const pages = new Map<number, SelectionPage>();
  try {
    for (const target of targets) {
      signal.throwIfAborted();
      if (target.object) {
        ids.add(target.object.id);
        seed ??= target.object;
        continue;
      }
      if (seen.has(target.key)) continue;
      seen.add(target.key);
      if (!target.item) continue;
      let data = pages.get(target.page);
      if (!data) {
        const page = await pdf.getPage(target.page);
        data = {
          page,
          content: await page.getTextContent(),
          viewport: page.getViewport({ scale: 1 }),
        };
        pages.set(target.page, data);
      }
      const split = await sourceRunAtPoint(data.page, target.item);
      const runs = split.splitItems?.items.map((run) =>
        paintedTextItem(run, target.item!.fontName),
      ) ?? [target.item];
      for (const item of runs) {
        signal.throwIfAborted();
        const object = sourceTextObject(
          data.page,
          [item],
          0,
          data.content.styles,
          objects.filter((object) => object.page === target.page),
        );
        if (!object) continue;
        if (object.sourceLayout) object.sourceLayout.splitItems = split.splitItems;
        if (object.cover) {
          let background = target.background;
          if (!background) {
            if (sampling?.page !== target.page) {
              if (sampling) sampling.canvas.width = sampling.canvas.height = 0;
              const viewport = data.page.getViewport({ scale: 1 });
              const canvas = globalThis.document.createElement('canvas');
              canvas.width = Math.ceil(viewport.width);
              canvas.height = Math.ceil(viewport.height);
              sampling = { page: target.page, canvas, viewport };
              const render = data.page.render({ canvas, viewport });
              const cancel = () => render.cancel();
              signal.addEventListener('abort', cancel, { once: true });
              try {
                await render.promise;
              } finally {
                signal.removeEventListener('abort', cancel);
              }
            }
            const angle = ((object.cover.rotation ?? 0) * Math.PI) / 180;
            const corners = [
              [0, 0],
              [object.cover.width, 0],
              [0, object.cover.height],
              [object.cover.width, object.cover.height],
            ].map(([x, y]) =>
              sampling!.viewport.convertToViewportPoint(
                (object.cover!.x ?? object.x) - 2 + Math.cos(angle) * x - Math.sin(angle) * y,
                (object.cover!.y ?? object.y) - 2 + Math.sin(angle) * x + Math.cos(angle) * y,
              ),
            );
            const left = Math.min(...corners.map(([x]) => x)),
              top = Math.min(...corners.map(([, y]) => y));
            background = sampleTextBackground(sampling.canvas, {
              left,
              top,
              width: Math.max(...corners.map(([x]) => x)) - left,
              height: Math.max(...corners.map(([, y]) => y)) - top,
            });
          }
          object.cover.color = background;
        }
        const prepared = await preserveSourceFont(data.page, item, object, document);
        additions.push(prepared);
        ids.add(prepared.id);
        seed ??= prepared;
      }
    }
    signal.throwIfAborted();
    return seed
      ? {
          documentId: document.id,
          objects,
          order,
          ids: [...ids],
          additions,
          seed,
          text: selectionText(targets),
          keys: targets.map((target) => target.key),
        }
      : undefined;
  } finally {
    if (sampling) sampling.canvas.width = sampling.canvas.height = 0;
  }
}
