import { useEffect, type RefObject } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { fittedZoom } from '../lib/viewGeometry';
import { useAppStore } from '../store/useAppStore';
import { useViewStore } from '../store/useViewStore';

export function useViewFit(pdf: PDFDocumentProxy | undefined, canvas: RefObject<HTMLElement>) {
  const mode = useViewStore((state) => state.zoomMode);
  const { selectedPage, pageSettings } = useAppStore();
  const source = pageSettings.order[selectedPage - 1] ?? selectedPage;
  const rotation = pageSettings.rotations[source] ?? 0;
  useEffect(() => {
    const node = canvas.current;
    if (!pdf || !node || mode === 'custom') return;
    let alive = true;
    let frame = 0;
    const fit = () => {
      void pdf.getPage(source).then((page) => {
        if (!alive) return;
        const style = getComputedStyle(node);
        const width = node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const height = node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 20;
        const zoom = fittedZoom(mode, page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 }), { width, height });
        if (zoom !== undefined && zoom !== useAppStore.getState().zoom) useAppStore.getState().setZoom(zoom);
      }).catch(() => undefined);
    };
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); });
    observer.observe(node);
    fit();
    return () => { alive = false; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [pdf, canvas, source, rotation, mode]);
}
