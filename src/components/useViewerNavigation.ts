import { useCallback, useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { visiblePage } from '../lib/viewGeometry';
import { useAppStore } from '../store/useAppStore';
import { revealTextObject } from './revealTextObject';

export function useViewerNavigation(pdf: PDFDocumentProxy | undefined, selectedPage: number, order: number[], zoom: number) {
  const refs = useRef(new Map<number, HTMLElement>());
  const scrollSelection = useRef<number>();
  const pending = useRef<number>();
  const targetScroll = useRef<number>();
  const targetScrollHeight = useRef<number>();
  const updateOnRelease = useRef<() => void>();
  const releaseFrame = useRef(0);
  const request = useAppStore((state) => state.pageNavigationRequest);
  const lastRequest = useRef(request);
  const scrollToPage = useCallback((number: number) => {
    const sheet = refs.current.get(number);
    const canvas = sheet?.closest<HTMLElement>('.canvas');
    if (!sheet || !canvas) return;
    const bounds = sheet.getBoundingClientRect(), viewport = canvas.getBoundingClientRect();
    canvas.scrollTop += bounds.top - viewport.top - parseFloat(getComputedStyle(canvas).paddingTop);
    targetScroll.current = canvas.scrollTop;
    targetScrollHeight.current = canvas.scrollHeight;
    if (bounds.width <= canvas.clientWidth) canvas.scrollLeft = 0;
  }, []);
  const release = useCallback(() => {
    cancelAnimationFrame(releaseFrame.current);
    releaseFrame.current = requestAnimationFrame(() => {
      releaseFrame.current = requestAnimationFrame(() => { pending.current = undefined; updateOnRelease.current?.(); });
    });
  }, []);
  const onPageReady = useCallback((number: number) => {
    if (number !== pending.current) return;
    scrollToPage(number); release();
    revealTextObject(useAppStore.getState().selectedObjectId, number);
  }, [scrollToPage, release]);

  useEffect(() => {
    if (!pdf) return;
    // A scroll updates the indicator, while an explicit navigation also reveals the page.
    if (scrollSelection.current === selectedPage && lastRequest.current === request) {
      scrollSelection.current = undefined; return;
    }
    lastRequest.current = request;
    scrollSelection.current = undefined;
    pending.current = selectedPage;
    scrollToPage(selectedPage);
    if (refs.current.get(selectedPage)?.dataset.rendered === 'true') release();
  }, [pdf, selectedPage, order, zoom, request, scrollToPage, release]);

  useEffect(() => {
    const canvas = refs.current.get(1)?.closest<HTMLElement>('.canvas');
    if (!pdf || !canvas) return;
    let frame = 0;
    const update = () => {
      if (pending.current !== undefined) return;
      const bounds = canvas.getBoundingClientRect();
      const page = visiblePage([...refs.current].map(([number, sheet]) => {
        const rect = sheet.getBoundingClientRect();
        return { number, top: rect.top, bottom: rect.bottom };
      }), bounds.top, canvas.clientHeight);
      if (page && page !== useAppStore.getState().selectedPage) {
        scrollSelection.current = page;
        useAppStore.setState({ selectedPage: page });
      }
    };
    updateOnRelease.current = update;
    const onScroll = () => {
      // Manual scrolling supersedes an unfinished reveal during initial rendering.
      if (pending.current !== undefined && targetScroll.current !== undefined && canvas.scrollHeight === targetScrollHeight.current && Math.abs(canvas.scrollTop - targetScroll.current) > 2) {
        pending.current = undefined;
        cancelAnimationFrame(releaseFrame.current);
      }
      cancelAnimationFrame(frame); frame = requestAnimationFrame(update);
    };
    canvas.addEventListener('scroll', onScroll, { passive: true });
    return () => { canvas.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); updateOnRelease.current = undefined; };
  }, [pdf, order]);
  useEffect(() => () => cancelAnimationFrame(releaseFrame.current), []);
  return { pageRefs: refs, onPageReady };
}
