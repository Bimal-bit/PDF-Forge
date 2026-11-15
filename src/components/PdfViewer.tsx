import { TextLayer, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import { openPdf } from '../lib/pdf';
import type { OpenDocument } from '../types';

interface PdfViewerProps {
  document: OpenDocument;
  zoom: number;
  selectedPage: number;
  onDocumentLoaded: (pdf: PDFDocumentProxy) => void;
}

const RENDER_SCALE = 1.5;

export function PdfViewer({ document, zoom, selectedPage, onDocumentLoaded }: PdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [error, setError] = useState<string>();
  const pageRefs = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    let live = true;
    setPdf(undefined); setError(undefined);
    void openPdf(document).then((loaded) => {
      if (!live) return;
      setPdf(loaded); onDocumentLoaded(loaded);
    }).catch(() => { if (live) setError('PDFForge could not render this PDF.'); });
    return () => { live = false; };
    // Document identity, not zoom, owns the pdf.js lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  useEffect(() => {
    pageRefs.current.get(selectedPage)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedPage]);

  if (error) return <div className="viewer-message" role="alert">{error}</div>;
  if (!pdf) return <div className="viewer-message">Preparing local PDF…</div>;
  return <div className="page-stack" aria-label="Rendered PDF pages">
    {Array.from({ length: pdf.numPages }, (_, index) => <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} zoom={zoom} pageRef={(node) => { if (node) pageRefs.current.set(index + 1, node); }} />)}
  </div>;
}

function PdfPage({ pdf, pageNumber, zoom, pageRef }: { pdf: PDFDocumentProxy; pageNumber: number; zoom: number; pageRef: (node: HTMLElement | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);

  useEffect(() => {
    const node = canvasRef.current?.parentElement;
    if (!node || visible) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: '900px' });
    observer.observe(node); return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !canvasRef.current || !textRef.current) return;
    let cancelled = false;
    let renderTask: ReturnType<PDFPageProxy['render']> | undefined;
    void pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled || !canvasRef.current || !textRef.current) return;
      const viewport = page.getViewport({ scale: zoom / 100 });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width * RENDER_SCALE); canvas.height = Math.ceil(viewport.height * RENDER_SCALE);
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      textRef.current.replaceChildren();
      textRef.current.style.width = canvas.style.width; textRef.current.style.height = canvas.style.height;
      renderTask = page.render({ canvas, viewport, transform: [RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0] });
      await Promise.all([renderTask.promise, new TextLayer({ textContentSource: await page.getTextContent(), container: textRef.current, viewport }).render()]);
    }).catch((reason: unknown) => { if (!cancelled && !(reason instanceof Error && reason.name === 'RenderingCancelledException')) console.warn('Unable to render PDF page', reason); });
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pdf, pageNumber, visible, zoom]);

  return <article ref={pageRef} className="pdf-page" aria-label={`Page ${pageNumber}`}><canvas ref={canvasRef} /><div ref={textRef} className="text-layer" />{!visible && <span className="page-placeholder">Page {pageNumber}</span>}<span className="page-number">{pageNumber}</span></article>;
}
