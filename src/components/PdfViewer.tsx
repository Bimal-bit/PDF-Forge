import { TextLayer, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { openPdf } from '../lib/pdf';
import { sourceTextObject } from '../lib/sourceText';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { isAnnotation } from '../lib/annotations';
import { AnnotationView } from './AnnotationView';
import type { OpenDocument } from '../types';
import type { EditorObject, TextObject } from '../types';
import { layoutTextFrames, type TextFrameLayout } from '../lib/textFlow';
import { TableView } from './TableView';
import { LinkView } from './LinkView';
import { TextFrameView } from './TextFrameView';
import { InPlaceTextEditor, type CaretPoint } from './InPlaceTextEditor';
import { DiagramLayer } from './DiagramLayer';
import { EquationView } from './EquationView';
import { equationLayout } from '../lib/equations';
import { useAppStore } from '../store/useAppStore';
import { preserveSourceFont } from '../lib/sourceFonts';
import { TextObjectView } from './TextObjectView';
import { useTextFonts } from './useTextFonts';
import { useTextEditStore } from '../store/useTextEditStore';
import { textBackground } from '../lib/textBackground';
import { sourceRunAtPoint } from '../lib/sourceRuns';
import { SelectionLayer } from './SelectionLayer';
import { useDocumentSelection } from './useDocumentSelection';
import { useTextSelectionStore } from '../store/useTextSelectionStore';
import type { RenderedSelectionTarget, SelectionPage } from '../lib/textSelection';
import { useViewerNavigation } from './useViewerNavigation';
import { useViewStore } from '../store/useViewStore';

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
  const registerSelection = useDocumentSelection(pdf, document.id);
  const [error, setError] = useState<string>();
  useTextFonts(objects);
  const frameLayouts = layoutTextFrames(objects, pageOrder);
  const { pageRefs, onPageReady } = useViewerNavigation(pdf, selectedPage, pageOrder, zoom);

  useEffect(() => {
    let live = true;
    let ownedPdf: PDFDocumentProxy | undefined;
    setPdf(undefined); setError(undefined);
    useTextEditStore.getState().setDraft(undefined);
    void openPdf(document).then((loaded) => {
      if (!live) { void loaded.loadingTask.destroy(); return; }
      ownedPdf = loaded;
      setPdf(loaded); onDocumentLoaded(loaded);
    }).catch(() => { if (live) setError('PDFForge could not render this PDF.'); });
    return () => { live = false; void ownedPdf?.loadingTask.destroy(); };
    // Document identity, not zoom, owns the pdf.js lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  if (error) return <div className="viewer-message" role="alert">{error}</div>;
  if (!pdf) return <div className="viewer-message">Preparing local PDF…</div>;
  const pages = pageOrder.length ? pageOrder : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  return <div className="page-stack" aria-label="Rendered PDF pages">
    {pages.map((sourcePage, index) => <PdfPage key={`${sourcePage}-${index}`} pdf={pdf} pageNumber={index + 1} sourcePage={sourcePage} rotation={rotations[sourcePage] ?? 0} zoom={zoom} objects={objects} pageOrder={pageOrder} onSelectionReady={registerSelection} frameLayouts={frameLayouts} onCreateTextObject={onCreateTextObject} onPageReady={onPageReady} pageRef={(node) => { if (node) pageRefs.current.set(index + 1, node); else pageRefs.current.delete(index + 1); }} />)}
  </div>;
}

function PdfPage({ pdf, pageNumber, sourcePage, rotation, zoom, objects: allObjects, pageOrder, onSelectionReady, frameLayouts, onCreateTextObject, onPageReady, pageRef }: { pdf: PDFDocumentProxy; pageNumber: number; sourcePage: number; rotation: number; zoom: number; objects: EditorObject[]; pageOrder: number[]; onSelectionReady: (page: number, targets: RenderedSelectionTarget[]) => void; frameLayouts: Map<string, TextFrameLayout>; onCreateTextObject: (object: TextObject) => void; onPageReady: (number: number) => void; pageRef: (node: HTMLElement | null) => void }) {
  const objects = useMemo(() => allObjects.filter((object) => object.page === sourcePage), [allObjects, sourcePage]);
  const selecting = useTextSelectionStore((state) => state.mode === 'select');
  const active = useAppStore((state) => state.selectedPage === pageNumber);
  const [selectionSource, setSelectionSource] = useState<SelectionPage>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2 || active);
  useEffect(() => { if (active) setVisible(true); }, [active]);
  const [editing, setEditing] = useState<TextObject>();
  const [caretPoint,setCaretPoint] = useState<CaretPoint>();
  const [layerStyle, setLayerStyle] = useState<CSSProperties>();
  const [size, setSize] = useState({ width: 500, height: 650 });
  const inverted = useViewStore((state) => state.inverted);
  const article = useRef<HTMLElement | null>(null);

  // Page dictionaries are cheap; only nearby pages allocate a render canvas.
  useEffect(() => {
    let alive = true;
    void pdf.getPage(sourcePage).then((page) => {
      const viewport = page.getViewport({ scale: zoom / 100, rotation: (page.rotate + rotation) % 360 });
      if (alive) setSize({ width: viewport.width, height: viewport.height });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [pdf, sourcePage, rotation, zoom]);

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
    let textRendering = false;
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
      const textContainer = textRef.current;
      const staging = globalThis.document.createElement('div');
      staging.style.setProperty('--total-scale-factor', String(scale));
      renderTask = page.render({ canvas, viewport, transform: [RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0] });
      // Observe cancellation immediately, including while text extraction is pending.
      const rendering = renderTask.promise;
      void rendering.catch(() => undefined);
      const content = await page.getTextContent();
      if (cancelled) return;
      const textItems = content.items.filter((item): item is TextItem => 'str' in item);
      textLayer = new TextLayer({ textContentSource: content, container: staging, viewport });
      textRendering = true;
      const renderedLayer = textLayer.render().finally(() => { textRendering = false; if (cancelled) textLayer?.cancel(); });
      await Promise.all([rendering, renderedLayer]);
      const renderedText = textLayer;
      if (cancelled) return;
      textContainer.style.cssText = staging.style.cssText;
      const mainRotation = staging.getAttribute('data-main-rotation');
      if (mainRotation) textContainer.setAttribute('data-main-rotation', mainRotation);
      else textContainer.removeAttribute('data-main-rotation');
      textContainer.replaceChildren(...staging.childNodes);
      setSelectionSource({ page, content, viewport });
      if (article.current) article.current.dataset.rendered = 'true';
      onPageReady(pageNumber);
      renderedText.textDivs.forEach((div, index) => {
        div.title = 'Click to edit text';
        div.tabIndex = 0;
        div.setAttribute('role', 'button');
        div.setAttribute('aria-label', `Edit text: ${textItems[index]?.str ?? ''}`);
        const edit = async (point?:CaretPoint) => {
          const current = useAppStore.getState();
          const rectangle=canvas.getBoundingClientRect();
          const target=await sourceRunAtPoint(page,textItems[index],point?viewport.convertToPdfPoint(point.x-rectangle.left,point.y-rectangle.top):undefined);
          const object = sourceTextObject(page, [target.item], 0, content.styles, current.objects.filter((entry) => entry.page === sourcePage));
          if (!object) return;
          if(object.sourceLayout)object.sourceLayout.splitItems=target.splitItems;
          if(object.cover) object.cover.color=textBackground(canvas,div);
          try {
            const prepared = await preserveSourceFont(page, target.item, object,current.document);
            if (!cancelled && current.document === useAppStore.getState().document && current.objects === useAppStore.getState().objects) {
              current.selectObject(undefined);setCaretPoint(point);setEditing(prepared);
            }
          } catch {
            if (!cancelled && current.document === useAppStore.getState().document) {
              setEditing({ ...object, fallback: true });
              current.setNotice('Could not reuse the source font. Import its matching TTF/OTF in Home.');
            }
          }
        };
        div.addEventListener('click', (event) => {
          // Preserve drag selection; a plain click enters the editor.
          if (useTextSelectionStore.getState().mode === 'edit' && event.detail <= 1 && !window.getSelection()?.toString()) void edit({x:event.clientX,y:event.clientY});
        });
        div.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void edit(); }
        });
      });
    }).catch((reason: unknown) => { if (!cancelled && !(reason instanceof Error && reason.name === 'RenderingCancelledException')) console.warn('Unable to render PDF page', reason); });
    return () => { cancelled = true; if (article.current) article.current.dataset.rendered = 'false'; renderTask?.cancel(); if (!textRendering) textLayer?.cancel(); };
  }, [pdf, pageNumber, sourcePage, rotation, visible, zoom, onPageReady]);

  return <article ref={(node) => { article.current = node; pageRef(node); }} style={size} className={`pdf-page${inverted ? ' night-reading' : ''}${selecting ? ' selecting-text' : ''}`} data-page-number={pageNumber} aria-label={`Page ${pageNumber}`}><canvas ref={canvasRef} /><div ref={textRef} className="text-layer" /><div className="object-layer" style={layerStyle}><DiagramLayer objects={objects} width={Number(layerStyle?.width ?? 0) * 100 / zoom} height={Number(layerStyle?.height ?? 0) * 100 / zoom} zoom={zoom} />{objects.filter((object)=>object.id!==editing?.id).map((object) => <ObjectView key={object.id} object={object} zoom={zoom} layout={frameLayouts.get(object.id)} onEdit={(text,point) => { if (useTextSelectionStore.getState().mode !== 'edit') return; useAppStore.getState().selectObject(text.id); setCaretPoint(point); setEditing(text); }} />)}{editing && <InPlaceTextEditor key={editing.id} object={editing} zoom={zoom} caretPoint={caretPoint} onCancel={() => setEditing(undefined)} onCommit={(text) => {
    const current = useAppStore.getState();
    const existing = current.objects.find((object) => object.id === editing.id);
    if (existing?.type === 'text') {
      if (existing.text !== text) current.updateTextObject(existing.id, text);
      useTextEditStore.getState().setDraft(undefined);
    } else if(editing.text !== text) {
      onCreateTextObject({ ...editing, text });
      useTextEditStore.getState().setDraft(undefined);
    }
    setEditing(undefined);
  }} />}</div>{selecting && selectionSource && canvasRef.current && <SelectionLayer source={selectionSource} objects={allObjects} order={pageOrder} pageNumber={pageNumber} zoom={zoom} layerStyle={layerStyle} canvas={canvasRef.current} onReady={onSelectionReady} />}{!visible && <span className="page-placeholder">Page {pageNumber}</span>}<span className="page-number">{pageNumber}</span></article>;
}

function ObjectView({ object, zoom, layout, onEdit }: { object: EditorObject; zoom: number; layout?: TextFrameLayout; onEdit: (object: TextObject,point?:CaretPoint) => void }) {
  const scale = zoom / 100;
  if (object.type === 'text' && layout) return <TextFrameView object={object} layout={layout} zoom={zoom} />;
  if (object.type === 'equation') { const math = equationLayout(object.latex, object.fontSize); return <span className="equation-object" data-editor-object-id={object.id} aria-label={object.latex} style={{ position: 'absolute', left: object.x * scale, bottom: object.y * scale, width: math.width * scale, height: (math.ascent + math.descent) * scale, transformOrigin: 'bottom left' }}><span style={{ display: 'block', transform: `scale(${scale})`, transformOrigin: 'top left' }}><EquationView layout={math} color={object.color} responsive={false} /></span></span>; }
  if (object.type === 'text') return <TextObjectView object={object} zoom={zoom} onEdit={onEdit} />;
  if (object.type === 'shape' || object.type === 'connector') return null;
  if (object.type === 'image') return <img className="image-object" data-editor-object-id={object.id} src={object.dataUrl} alt="Inserted" style={{ left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale }} />;
  if (object.type === 'table') return <TableView object={object} zoom={zoom} />;
  if (object.type === 'link') return <LinkView object={object} zoom={zoom} />;
  if (object.type === 'form') {
    const style = { left: object.x * scale, bottom: object.y * scale, width: object.width * scale, height: object.height * scale };
    if (object.kind === 'checkbox') return <span className="form-checkbox" data-editor-object-id={object.id} style={style}>{object.checked ? '✓' : ''}</span>;
    if (object.kind === 'signature') return <span className="form-signature" data-editor-object-id={object.id} style={style}><em>{object.value || 'Sign here'}</em></span>;
    return <span className="form-text" data-editor-object-id={object.id} style={style}>{object.value || object.label}</span>;
  }
  if (isAnnotation(object)) return <AnnotationView object={object} zoom={zoom} />;
  return null;
}
