import { TextLayer, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import { openPdf } from '../lib/pdf';
import { matchPdfFont } from '../lib/font';
import { measurementLabel } from '../lib/export';
import type { OpenDocument } from '../types';
import type { EditorObject, TextObject } from '../types';

interface PdfViewerProps {
  document: OpenDocument;
  zoom: number;
  selectedPage: number;
  objects: EditorObject[];
  pageOrder: number[];
  onCreateTextObject: (object: TextObject) => void;
  onDocumentLoaded: (pdf: PDFDocumentProxy) => void;
}

const RENDER_SCALE = 1.5;

export function PdfViewer({ document, zoom, selectedPage, objects, pageOrder, onCreateTextObject, onDocumentLoaded }: PdfViewerProps) {
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
  const pages = pageOrder.length ? pageOrder : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  return <div className="page-stack" aria-label="Rendered PDF pages">
    {pages.map((sourcePage, index) => <PdfPage key={`${sourcePage}-${index}`} pdf={pdf} pageNumber={index + 1} sourcePage={sourcePage} zoom={zoom} objects={objects.filter((object) => object.page === sourcePage)} onCreateTextObject={onCreateTextObject} pageRef={(node) => { if (node) pageRefs.current.set(index + 1, node); }} />)}
  </div>;
}

function PdfPage({ pdf, pageNumber, sourcePage, zoom, objects, onCreateTextObject, pageRef }: { pdf: PDFDocumentProxy; pageNumber: number; sourcePage: number; zoom: number; objects: EditorObject[]; onCreateTextObject: (object: TextObject) => void; pageRef: (node: HTMLElement | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [editing, setEditing] = useState<TextObject>();

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
    void pdf.getPage(sourcePage).then(async (page) => {
      if (cancelled || !canvasRef.current || !textRef.current) return;
      const viewport = page.getViewport({ scale: zoom / 100 });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width * RENDER_SCALE); canvas.height = Math.ceil(viewport.height * RENDER_SCALE);
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      textRef.current.replaceChildren();
      textRef.current.style.width = canvas.style.width; textRef.current.style.height = canvas.style.height;
      renderTask = page.render({ canvas, viewport, transform: [RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0] });
      const textLayer = new TextLayer({ textContentSource: await page.getTextContent(), container: textRef.current, viewport });
      await Promise.all([renderTask.promise, textLayer.render()]);
      textLayer.textDivs.forEach((div, index) => div.addEventListener('dblclick', () => {
        const pageRect = canvas.getBoundingClientRect(); const rect = div.getBoundingClientRect(); const style = getComputedStyle(div);
        const font = matchPdfFont(style.fontFamily);
        setEditing({ id: crypto.randomUUID(), type: 'text', page: pageNumber, text: textLayer.textContentItemsStr[index] ?? '', x: (rect.left - pageRect.left) * 100 / zoom, y: (pageRect.bottom - rect.bottom) * 100 / zoom, fontSize: Number.parseFloat(style.fontSize) * 100 / zoom || 12, color: '#292724', fontFamily: font.family, cover: { width: rect.width * 100 / zoom + 4, height: rect.height * 100 / zoom + 4 }, fallback: font.fallback });
      }));
    }).catch((reason: unknown) => { if (!cancelled && !(reason instanceof Error && reason.name === 'RenderingCancelledException')) console.warn('Unable to render PDF page', reason); });
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pdf, pageNumber, sourcePage, visible, zoom]);

  return <article ref={pageRef} className="pdf-page" aria-label={`Page ${pageNumber}`}><canvas ref={canvasRef} /><div ref={textRef} className="text-layer" />{objects.map((object) => <ObjectView key={object.id} object={object} zoom={zoom} />)}{editing && <textarea aria-label="Edit PDF text" className="inplace-editor" autoFocus defaultValue={editing.text} style={{ left: editing.x * zoom / 100, bottom: editing.y * zoom / 100, width: editing.cover!.width * zoom / 100, height: editing.cover!.height * zoom / 100, fontSize: editing.fontSize * zoom / 100 }} onBlur={(event) => { onCreateTextObject({ ...editing, text: event.target.value }); setEditing(undefined); }} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(undefined); }} />}{!visible && <span className="page-placeholder">Page {pageNumber}</span>}<span className="page-number">{pageNumber}</span></article>;
}

function ObjectView({ object, zoom }: { object: EditorObject; zoom: number }) {
  const scale = zoom / 100;
  if (object.type === 'text') return <span className="text-object" style={{ left: object.x * scale, bottom: object.y * scale, fontSize: object.fontSize * scale, color: object.color, fontFamily: object.fontFamily }}>{object.text}</span>;
  if (object.type === 'shape') return <span className="shape-object" style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale, borderColor: object.color }} />;
  if (object.type === 'image') return <img className="image-object" src={object.dataUrl} alt="Inserted" style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale }} />;
  if (object.type === 'table') return <table className="table-object" style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale }}>{<tbody>{object.cells.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>}</table>;
  if (object.type === 'link') return <a className="link-object" href={object.url} target="_blank" rel="noreferrer" style={{ left: object.x * scale, bottom: object.y * scale, fontSize: object.fontSize * scale }}>{object.label}</a>;
  if (object.type === 'highlight') return <span className="annotation-highlight" title={`${object.author}: ${object.comment}`} style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale, background: object.color }} />;
  if (object.type === 'note') return <span className="annotation-note" title={`${object.author}: ${object.comment}`} style={{ left: object.x * scale, bottom: object.y * scale }}>💬</span>;
  if (object.type === 'stamp') return <span className="annotation-stamp" style={{ left: object.x * scale, bottom: object.y * scale }}>{object.label}</span>;
  return <span className="annotation-measure" style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: Math.max(2, Math.abs(object.height) * scale) }}><span>{measurementLabel(object)}</span></span>;
}
