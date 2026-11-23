import { TextLayer } from 'pdfjs-dist';
import { useEffect, useRef, type CSSProperties } from 'react';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { EditorObject } from '../types';
import { inlineTextStyle } from '../lib/inlineText';
import {
  pageSelectionTargets,
  type RenderedSelectionTarget,
  type SelectionPage,
} from '../lib/textSelection';
import { textBackground } from '../lib/textBackground';
import { useTextSelectionStore } from '../store/useTextSelectionStore';
import '../text-selection.css';

function applyStyle(element: HTMLElement, style: CSSProperties) {
  const unitless = new Set(['fontWeight', 'lineHeight', 'zIndex', 'opacity']);
  for (const [name, value] of Object.entries(style)) {
    if (value !== undefined)
      Reflect.set(
        element.style,
        name,
        typeof value === 'number' && !unitless.has(name) ? `${value}px` : String(value),
      );
  }
}

export function SelectionLayer({
  source,
  objects,
  order,
  pageNumber,
  zoom,
  layerStyle,
  canvas,
  onReady,
}: {
  source: SelectionPage;
  objects: EditorObject[];
  order: number[];
  pageNumber: number;
  zoom: number;
  layerStyle?: CSSProperties;
  canvas: HTMLCanvasElement;
  onReady: (page: number, targets: RenderedSelectionTarget[]) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const entries = useRef<RenderedSelectionTarget[]>([]);
  const group = useTextSelectionStore((state) => state.group);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let cancelled = false;
    let rendering = true;
    // Render off-DOM so a replaced layer can finish safely without appending
    // stale spans or cancelling pdf.js while its stream callback is pumping.
    const staging = document.createElement('div');
    const items = source.content.items.filter((item): item is TextItem => 'str' in item);
    const targets = pageSelectionTargets(source.page.pageNumber, items, objects, order).map(
      (target) => ({ ...target, displayPage: pageNumber }),
    );
    const sourceTargets = targets.filter((target) => target.item);
    const textLayer = new TextLayer({
      textContentSource: { ...source.content, items: sourceTargets.map((target) => target.item!) },
      viewport: source.viewport,
      container: staging,
    });
    staging.style.setProperty('--total-scale-factor', String(zoom / 100));
    void textLayer
      .render()
      .then(() => {
        if (cancelled) return;
        node.style.cssText = staging.style.cssText;
        const rotation = staging.getAttribute('data-main-rotation');
        if (rotation) node.setAttribute('data-main-rotation', rotation);
        else node.removeAttribute('data-main-rotation');
        const elements = new Map(
          sourceTargets.map((target, index) => [target.key, textLayer.textDivs[index]]),
        );
        const result: RenderedSelectionTarget[] = [];
        const fragment = document.createDocumentFragment();
        for (const target of targets) {
          let element = elements.get(target.key);
          let wrapper: HTMLElement | undefined;
          if (target.object) {
            wrapper = document.createElement('div');
            wrapper.className = 'selection-object-position';
            applyStyle(wrapper, layerStyle ?? {});
            element = document.createElement('span');
            element.className = 'selection-object-text';
            element.textContent = target.text;
            const object = target.frameLine
              ? {
                  ...target.object,
                  text: target.text,
                  x: target.x,
                  y: target.y,
                  fontSize: target.size,
                  indent: 0,
                  sourceLayout: {
                    baselineOffset: 0,
                    ascent: 0.8,
                    horizontalScale: 1,
                    rotation: 0,
                    fontFamily: target.object.fontFamily ?? 'Helvetica',
                    bold: Boolean(target.object.bold),
                    italic: Boolean(target.object.italic),
                    wordSpacing: target.wordSpacing,
                  },
                }
              : { ...target.object, text: target.text };
            applyStyle(element, inlineTextStyle(object, zoom));
            wrapper.append(element);
          }
          if (!element) continue;
          element.dataset.selectionKey = target.key;
          element.classList.add('selectable-run');
          element.title = 'Drag to select text; Home formats the selected lines and blocks';
          fragment.append(wrapper ?? element);
          // A real line break keeps copied lines separate without adding visible ink.
          fragment.append(document.createElement('br'));
          result.push({ ...target, element });
        }
        node.replaceChildren(fragment);
        for (const target of result)
          if (target.item) target.background = textBackground(canvas, target.element);
        entries.current = result;
        const selected = useTextSelectionStore.getState().group;
        for (const target of result)
          target.element.classList.toggle(
            'selected-text-run',
            Boolean(
              selected?.keys.includes(target.key) ||
              selected?.ids.includes(target.object?.id ?? target.key),
            ),
          );
        onReady(pageNumber, result);
      })
      .catch((error: unknown) => {
        if (!cancelled) console.warn('Could not prepare selectable page text', error);
      })
      .finally(() => {
        rendering = false;
        if (cancelled) textLayer.cancel();
      });
    return () => {
      cancelled = true;
      if (!rendering) textLayer.cancel();
      onReady(pageNumber, []);
    };
  }, [source, objects, order, zoom, layerStyle, canvas, pageNumber, onReady]);
  useEffect(() => {
    for (const target of entries.current)
      target.element.classList.toggle(
        'selected-text-run',
        Boolean(
          group?.keys.includes(target.key) || group?.ids.includes(target.object?.id ?? target.key),
        ),
      );
  }, [group]);
  return (
    <div
      ref={container}
      className="text-layer selection-layer"
      role="region"
      aria-label={`Selectable text on page ${pageNumber}`}
      tabIndex={0}
    />
  );
}
