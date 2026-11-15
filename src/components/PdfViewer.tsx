import { TextLayer, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { openPdf } from '../lib/pdf';
import { paragraphAt } from '../lib/paragraphs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
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
  rotations: Record<number, number>;
  onCreateTextObject: (object: TextObject) => void;
  onDocumentLoaded: (pdf: PDFDocumentProxy) => void;
}

const RENDER_SCALE = 1.5;

export function PdfViewer({ document, zoom, selectedPage, objects, pageOrder, rotations, onCreateTextObject, onDocumentLoaded }: PdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [error, setError] = useState<string>();
  const pageRefs = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    let live = true;
    let ownedPdf: PDFDocumentProxy | undefined;
    setPdf(undefined); setError(undefined);
    void openPdf(document).then((loaded) => {
      if (!live) { void loaded.loadingTask.destroy(); return; }
      ownedPdf = loaded;
      setPdf(loaded); onDocumentLoaded(loaded);
    }).catch(() => { if (live) setError('PDFForge could not render this PDF.'); });
    return () => { live = false; void ownedPdf?.loadingTask.destroy(); };
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
    {pages.map((sourcePage, index) => <PdfPage key={`${sourcePage}-${index}`} pdf={pdf} pageNumber={index + 1} sourcePage={sourcePage} rotation={rotations[sourcePage] ?? 0} zoom={zoom} objects={objects.filter((object) => object.page === sourcePage)} onCreateTextObject={onCreateTextObject} pageRef={(node) => { if (node) pageRefs.current.set(index + 1, node); }} />)}
  </div>;
}

function PdfPage({ pdf, pageNumber, sourcePage, rotation, zoom, objects, onCreateTextObject, pageRef }: { pdf: PDFDocumentProxy; pageNumber: number; sourcePage: number; rotation: number; zoom: number; objects: EditorObject[]; onCreateTextObject: (object: TextObject) => void; pageRef: (node: HTMLElement | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [editing, setEditing] = useState<TextObject>();
  const [layerStyle, setLayerStyle] = useState<CSSProperties>();

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
    let textLayer: TextLayer | undefined;
    void pdf.getPage(sourcePage).then(async (page) => {
      if (cancelled || !canvasRef.current || !textRef.current) return;
      const scale = zoom / 100;
      const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
      const [a, b, c, d, e, f] = viewport.transform;
      const top = viewport.viewBox[3];
      setLayerStyle({ position: 'absolute', left: 0, top: 0, width: viewport.viewBox[2] * scale, height: top * scale, transformOrigin: '0 0', transform: `matrix(${a / scale}, ${b / scale}, ${-c / scale}, ${-d / scale}, ${c * top + e}, ${d * top + f})`, pointerEvents: 'none' });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width * RENDER_SCALE); canvas.height = Math.ceil(viewport.height * RENDER_SCALE);
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      textRef.current.replaceChildren();
      textRef.current.style.width = canvas.style.width; textRef.current.style.height = canvas.style.height;
      renderTask = page.render({ canvas, viewport, transform: [RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0] });
      const content = await page.getTextContent();
      const textItems = content.items.filter((item): item is TextItem => 'str' in item);
      textLayer = new TextLayer({ textContentSource: content, container: textRef.current, viewport });
      await Promise.all([renderTask.promise, textLayer.render()]);
      const renderedText = textLayer;
      if (cancelled) return;
      renderedText.textDivs.forEach((div, index) => div.addEventListener('dblclick', () => {
        const pageRect = canvas.getBoundingClientRect(); const rect = div.getBoundingClientRect(); const style = getComputedStyle(div);
        const font = matchPdfFont(style.fontFamily);
        const points = [[rect.left - pageRect.left, rect.top - pageRect.top], [rect.right - pageRect.left, rect.bottom - pageRect.top]].map(([x, y]) => viewport.convertToPdfPoint(x, y));
        const x = Math.min(...points.map((point) => point[0]));
        const y = Math.min(...points.map((point) => point[1]));
        const width = Math.abs(points[1][0] - points[0][0]);
        const height = Math.abs(points[1][1] - points[0][1]);
        const paragraph = paragraphAt(textItems, index);
        setEditing({ id: crypto.randomUUID(), type: 'text', page: sourcePage, text: paragraph.text || renderedText.textContentItemsStr[index] || '', x: paragraph.x ?? x, y: paragraph.y ?? y, fontSize: Number.parseFloat(style.fontSize) * 100 / zoom || 12, color: '#292724', fontFamily: font.family, width: paragraph.width || width + 4, height: paragraph.height || height + 4, cover: { width: paragraph.width || width + 4, height: paragraph.height || height + 4 }, fallback: font.fallback });
      }));
    }).catch((reason: unknown) => { if (!cancelled && !(reason instanceof Error && reason.name === 'RenderingCancelledException')) console.warn('Unable to render PDF page', reason); });
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel(); };
  }, [pdf, pageNumber, sourcePage, rotation, visible, zoom]);

  return <article ref={pageRef} className="pdf-page" aria-label={`Page ${pageNumber}`}><canvas ref={canvasRef} /><div ref={textRef} className="text-layer" /><div className="object-layer" style={layerStyle}>{objects.map((object) => <ObjectView key={object.id} object={object} zoom={zoom} />)}{editing && <textarea aria-label="Edit PDF text" className="inplace-editor" autoFocus defaultValue={editing.text} style={{ left: editing.x * zoom / 100, bottom: editing.y * zoom / 100, width: editing.cover!.width * zoom / 100, height: editing.cover!.height * zoom / 100, fontSize: editing.fontSize * zoom / 100 }} onBlur={(event) => { onCreateTextObject({ ...editing, text: event.target.value }); setEditing(undefined); }} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(undefined); }} />}</div>{!visible && <span className="page-placeholder">Page {pageNumber}</span>}<span className="page-number">{pageNumber}</span></article>;
}

function ObjectView({ object, zoom }: { object: EditorObject; zoom: number }) {
  const scale = zoom / 100;
  if (object.type === 'text') return <>{object.cover && <span style={{ position: 'absolute', left: (object.x - 2) * scale, bottom: (object.y - 2) * scale, width: object.cover.width * scale, height: object.cover.height * scale, background: 'white', zIndex: 2 }} />}<span className="text-object" style={{ left: object.x * scale, bottom: object.y * scale, fontSize: object.fontSize * scale, color: object.color, fontFamily: object.fontFamily === 'Times-Roman' ? 'Times New Roman, serif' : object.fontFamily, width: (object.width ?? object.cover?.width ?? 0) * scale || undefined, height: object.height ? object.height * scale : undefined, fontWeight: object.bold ? 'bold' : 'normal', fontStyle: object.italic ? 'italic' : 'normal', textDecoration: [object.underline ? 'underline' : '', object.strike ? 'line-through' : ''].join(' '), textAlign: object.alignment, lineHeight: object.lineHeight ?? 1.2, letterSpacing: (object.letterSpacing ?? 0) * scale, paddingLeft: (object.indent ?? 0) * scale, whiteSpace: 'pre-wrap', transform: object.height || object.cover || object.width ? undefined : 'translateY(80%)' }}>{object.text.split(/\r?\n/).map((line, index) => object.list === 'bullet' ? `\u2022 ${line}` : object.list === 'number' ? `${index + 1}. ${line}` : line).join('\n')}</span></>;
  if (object.type === 'shape') return <span className="shape-object" style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale, borderColor: object.color }} />;
  if (object.type === 'image') return <img className="image-object" src={object.dataUrl} alt="Inserted" style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale }} />;
  if (object.type === 'table') return <table className="table-object" style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale }}>{<tbody>{object.cells.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>}</table>;
  if (object.type === 'link') return <a className="link-object" href={object.url} target="_blank" rel="noreferrer" style={{ left: object.x * scale, bottom: object.y * scale, fontSize: object.fontSize * scale }}>{object.label}</a>;
  if (object.type === 'form') {
    const style = { left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale };
    if (object.kind === 'checkbox') return <span className="form-checkbox" style={style}>{object.checked ? '✓' : ''}</span>;
    if (object.kind === 'signature') return <span className="form-signature" style={style}><em>{object.value || 'Sign here'}</em></span>;
    return <span className="form-text" style={style}>{object.value || object.label}</span>;
  }
  if (object.type === 'highlight') return <span className="annotation-highlight" title={`${object.author}: ${object.comment}`} style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale, background: object.color }} />;
  if (object.type === 'note') return <span className="annotation-note" title={`${object.author}: ${object.comment}`} style={{ left: object.x * scale, bottom: object.y * scale }}>💬</span>;
  if (object.type === 'stamp') return <span className="annotation-stamp" style={{ left: object.x * scale, bottom: object.y * scale }}>{object.label}</span>;
  return <span className="annotation-measure" style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: Math.max(2, Math.abs(object.height) * scale) }}><span>{measurementLabel(object)}</span></span>;
}
