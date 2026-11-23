import { useCallback, useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { useAppStore } from '../store/useAppStore';
import { useTextEditStore } from '../store/useTextEditStore';
import { useTextSelectionStore } from '../store/useTextSelectionStore';
import {
  pageSelectionTargets,
  prepareTextSelection,
  type RenderedSelectionTarget,
  type SelectionTarget,
} from '../lib/textSelection';
import { selectBetweenPoints, selectedTargets, type SelectionPoint } from '../lib/textSelectionDom';

interface Gesture {
  anchor: SelectionPoint;
  focus: SelectionPoint;
  page: number;
  editing: boolean;
  bounds: DOMRect;
  finished: boolean;
}

export function useDocumentSelection(pdf: PDFDocumentProxy | undefined, documentId: string) {
  const registry = useRef(new Map<number, RenderedSelectionTarget[]>());
  const gesture = useRef<Gesture>();
  const controller = useRef<AbortController>();
  const applyGesture = useRef<() => void>(() => {});
  const handled = useRef(0);
  const request = useTextSelectionStore((state) => state.allRequested);
  const mode = useTextSelectionStore((state) => state.mode);
  const { objects, pageSettings } = useAppStore();
  const register = useCallback((page: number, targets: RenderedSelectionTarget[]) => {
    registry.current.set(page, targets);
    if (gesture.current?.finished && targets.length)
      requestAnimationFrame(() => applyGesture.current());
  }, []);
  const rendered = useCallback(
    () => [...registry.current].sort(([a], [b]) => a - b).flatMap(([, targets]) => targets),
    [],
  );
  const prepare = useCallback(
    async (targets: SelectionTarget[]) => {
      if (!pdf) return;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      const snapshot = useAppStore.getState();
      if (!snapshot.document) return;
      useTextSelectionStore.getState().setGroup(undefined);
      useTextSelectionStore.getState().setBusy(true);
      try {
        const group = await prepareTextSelection(
          pdf,
          snapshot.document,
          snapshot.objects,
          snapshot.pageSettings.order,
          targets,
          abort.signal,
        );
        const current = useAppStore.getState();
        if (
          !abort.signal.aborted &&
          current.document === snapshot.document &&
          current.objects === snapshot.objects &&
          current.pageSettings.order === snapshot.pageSettings.order &&
          useTextSelectionStore.getState().mode === 'select'
        ) {
          useTextEditStore.getState().setDraft(undefined);
          useTextSelectionStore.getState().setGroup(group);
          if (!group)
            snapshot.setNotice('No editable text found. Use Offline OCR for image-only pages.');
        }
      } catch (error) {
        if (!abort.signal.aborted)
          snapshot.setNotice(
            error instanceof Error ? error.message : 'Could not select this text.',
          );
      } finally {
        if (!abort.signal.aborted) useTextSelectionStore.getState().setBusy(false);
      }
    },
    [pdf],
  );

  useEffect(() => {
    useTextSelectionStore.getState().reset();
    registry.current.clear();
    handled.current = 0;
    return () => {
      controller.current?.abort();
      useTextSelectionStore.getState().reset();
    };
  }, [documentId]);

  useEffect(() => {
    const group = useTextSelectionStore.getState().group;
    if (
      group &&
      (group.documentId !== documentId ||
        group.objects !== objects ||
        group.order !== pageSettings.order)
    )
      useTextSelectionStore.getState().setGroup(undefined);
  }, [documentId, objects, pageSettings.order]);

  useEffect(() => {
    if (mode === 'edit') {
      controller.current?.abort();
      gesture.current = undefined;
    }
  }, [mode]);

  useEffect(() => {
    if (!pdf || !request || request === handled.current) return;
    handled.current = request;
    controller.current?.abort();
    useTextSelectionStore.getState().setBusy(true);
    useTextSelectionStore.getState().setGroup(undefined);
    let cancelled = false;
    const snapshot = useAppStore.getState();
    void (async () => {
      const order = snapshot.pageSettings.order.length
        ? snapshot.pageSettings.order
        : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
      const targets: SelectionTarget[] = [];
      const backgrounds = new Map(rendered().map((target) => [target.key, target.background]));
      for (const [pageIndex, pageNumber] of order.entries()) {
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        targets.push(
          ...pageSelectionTargets(
            pageNumber,
            content.items.filter((item): item is TextItem => 'str' in item),
            snapshot.objects,
            order,
          ).map((target) => ({
            ...target,
            displayPage: pageIndex + 1,
            background: backgrounds.get(target.key),
          })),
        );
      }
      if (
        !cancelled &&
        useAppStore.getState().objects === snapshot.objects &&
        useTextSelectionStore.getState().mode === 'select'
      )
        await prepare(targets);
      else if (!cancelled) useTextSelectionStore.getState().setBusy(false);
    })().catch(() => {
      if (!cancelled) {
        useTextSelectionStore.getState().setBusy(false);
        snapshot.setNotice('Could not select all document text.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, request, rendered, prepare]);

  useEffect(() => {
    const collect = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) {
        controller.current?.abort();
        useTextSelectionStore.getState().setBusy(false);
        useTextSelectionStore.getState().setGroup(undefined);
        return;
      }
      const targets = selectedTargets(rendered(), selection.getRangeAt(0));
      if (targets.length) void prepare(targets);
      else useTextSelectionStore.getState().setGroup(undefined);
    };
    applyGesture.current = () => {
      const drag = gesture.current;
      if (!drag?.finished || !registry.current.get(drag.page)?.length) return;
      selectBetweenPoints(rendered(), drag.anchor, drag.focus);
      gesture.current = undefined;
      collect();
    };
    const down = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.button !== 0 ||
        !target.closest?.('.pdf-page') ||
        !target.closest('.text-layer span, .text-object, .inplace-editor')
      )
        return;
      if (useTextSelectionStore.getState().mode === 'select') return;
      const text = target.closest<HTMLElement>('.inplace-editor, .text-object, .text-layer span')!;
      const point = { x: event.clientX, y: event.clientY };
      gesture.current = {
        anchor: point,
        focus: point,
        page: Number(text.closest<HTMLElement>('.pdf-page')?.dataset.pageNumber),
        editing: Boolean(text.closest('.inplace-editor')),
        bounds: text.getBoundingClientRect(),
        finished: false,
      };
    };
    const move = (event: PointerEvent) => {
      const drag = gesture.current;
      if (!drag || !(event.buttons & 1)) return;
      drag.focus = { x: event.clientX, y: event.clientY };
      if (Math.hypot(drag.focus.x - drag.anchor.x, drag.focus.y - drag.anchor.y) < 4) return;
      if (
        drag.editing &&
        event.clientY >= drag.bounds.top - 2 &&
        event.clientY <= drag.bounds.bottom + 2
      )
        return;
      if (useTextSelectionStore.getState().mode !== 'select') {
        (document.activeElement as HTMLElement | null)?.blur();
        useTextEditStore.getState().setDraft(undefined);
        useTextSelectionStore.getState().setMode('select');
      }
    };
    const up = (event: PointerEvent) => {
      if (useTextSelectionStore.getState().mode !== 'select') {
        gesture.current = undefined;
        return;
      }
      if (gesture.current) {
        gesture.current.focus = { x: event.clientX, y: event.clientY };
        gesture.current.finished = true;
        requestAnimationFrame(() => applyGesture.current());
      } else if ((event.target as HTMLElement).closest?.('.selection-layer'))
        requestAnimationFrame(collect);
    };
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest?.('dialog')) return;
      const input = target.closest?.(
        'input, textarea, select, [contenteditable=true], [contenteditable=plaintext-only]',
      );
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'a' &&
        (!input || target.closest('.inplace-editor'))
      ) {
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        useTextEditStore.getState().setDraft(undefined);
        useTextSelectionStore.getState().selectAll();
      }
      if (
        event.key === 'Escape' &&
        !input &&
        useTextSelectionStore.getState().mode === 'select' &&
        !target.closest('dialog')
      ) {
        controller.current?.abort();
        useTextSelectionStore.getState().setMode('edit');
        window.getSelection()?.removeAllRanges();
      }
      if (event.shiftKey && target.closest?.('.selection-layer')) requestAnimationFrame(collect);
    };
    const copy = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      const selection = useTextSelectionStore.getState();
      const current = useAppStore.getState();
      if (
        !selection.group ||
        selection.mode !== 'select' ||
        target.closest?.('input, textarea, select, [contenteditable]') ||
        selection.group.objects !== current.objects
      )
        return;
      event.preventDefault();
      event.clipboardData?.setData('text/plain', selection.group.text);
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('copy', copy);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('copy', copy);
    };
  }, [prepare, rendered]);
  return register;
}
