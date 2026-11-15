import { FileText, ListTree, PanelRightClose, Search, Upload, X } from 'lucide-react';
import type { DragEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { findMatches } from '../lib/pdf';
import { FormProperties } from './FormProperties';
import { PdfViewer } from './PdfViewer';
import { useAppStore } from '../store/useAppStore';
import { toPdfDocument } from '../lib/file';

export function Panels() {
  const { document, isDragging, setDragging, setDocument, setNotice, rightPanelOpen, toggleRightPanel, zoom, selectedPage, setSelectedPage, objects, addObject, pageSettings, initializePages } = useAppStore();
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  useEffect(() => { setPdf(undefined); setOutline([]); setQuery(''); setHits([]); }, [document?.id]);
  const drop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (!file) return;
    try { setDocument(await toPdfDocument(file)); } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to open that file.'); }
  };
  return <main className="workspace" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    <Navigator document={document} pdf={pdf} outline={outline} selectedPage={selectedPage} onSelectPage={setSelectedPage} />
    <section className={`canvas ${isDragging ? 'dragging' : ''}`} aria-label="Document canvas">
      <div className="ruler">0 <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span></div>
      {document ? <><SearchBox pdf={pdf} query={query} setQuery={setQuery} hits={hits} setHits={setHits} onSelectPage={setSelectedPage} /><PdfViewer document={document} zoom={zoom} selectedPage={selectedPage} objects={objects} pageOrder={pageSettings.order} rotations={pageSettings.rotations} onCreateTextObject={addObject} onDocumentLoaded={(loaded) => { setPdf(loaded); initializePages(loaded.numPages); void loaded.getOutline().then((items) => { if (useAppStore.getState().document?.id === document.id) setOutline(items ?? []); }).catch(() => undefined); }} /></> : <div className="drop-zone"><Upload size={28} /><h1>Open a PDF to begin</h1><p>Drop a PDF here, or use the Open PDF button above.</p><span>Files stay in your browser.</span></div>}
      {isDragging && <div className="drop-overlay">Drop PDF to open</div>}
    </section>
    {rightPanelOpen && <aside className="right-panel" aria-label="Properties"><button className="close-panel" onClick={toggleRightPanel}><PanelRightClose size={16} /> Hide panel</button><p className="panel-label">DOCUMENT</p><dl><dt>Status</dt><dd>{document ? 'Rendered locally' : 'No document'}</dd><dt>Pages</dt><dd>{pdf?.numPages ?? '—'}</dd><dt>Zoom</dt><dd>{zoom}%</dd><dt>Autosave</dt><dd>Every 5 seconds</dd></dl>{objects.length > 0 && <ObjectEditor objects={objects} />}</aside>}
  </main>;
}

interface SearchHit { page: number; count: number }
interface OutlineItem { title: string; dest?: string | unknown[] | null; items: OutlineItem[] }

function ObjectEditor({ objects }: { objects: import('../types').EditorObject[] }) {
  const { updateTextObject, updateObject, removeObject } = useAppStore();
  return <aside className="object-editor-panel" aria-label="Export objects"><p className="panel-label">OBJECTS & COMMENTS</p>{objects.map((object) => <div className="object-editor" key={object.id}>{object.type === 'text' && <><label>Text<textarea aria-label="Overlay text" value={object.text} onChange={(event) => updateTextObject(object.id, event.target.value)} /></label>{object.fallback && <span className="fallback-warning">Fallback font: {object.fontFamily ?? 'Helvetica'}</span>}</>}{object.type === 'form' && <><label>Field label<input aria-label="Form field label" value={object.label} onChange={(event) => updateObject(object.id, { label: event.target.value })} /></label>{object.kind === 'checkbox' ? <label className="check-control"><input aria-label="Checkbox value" type="checkbox" checked={object.checked} onChange={(event) => updateObject(object.id, { checked: event.target.checked })} /> Checked</label> : <label>{object.kind === 'signature' ? 'Signer name' : 'Field value'}<input aria-label={object.kind === 'signature' ? 'Signer name' : 'Field value'} value={object.value} onChange={(event) => updateObject(object.id, { value: event.target.value })} /></label>}<FormProperties object={object} /><span className="field-kind">{object.kind === 'signature' ? 'Visible signature, not certificate signing' : `PDF ${object.kind} field`}</span></>}{object.type === 'link' && <label>Link URL<input aria-label="Link URL" value={object.url} onChange={(event) => updateObject(object.id, { url: event.target.value })} /></label>}{(object.type === 'highlight' || object.type === 'note') && <><label>Comment<textarea aria-label="Annotation comment" value={object.comment} onChange={(event) => updateObject(object.id, { comment: event.target.value })} /></label><label>Author<input aria-label="Annotation author" value={object.author} onChange={(event) => updateObject(object.id, { author: event.target.value })} /></label></>}{object.type === 'stamp' && <label>Stamp<select aria-label="Stamp label" value={object.label} onChange={(event) => updateObject(object.id, { label: event.target.value as 'APPROVED' | 'DRAFT' | 'CONFIDENTIAL' })}><option>APPROVED</option><option>DRAFT</option><option>CONFIDENTIAL</option></select></label>}{object.type === 'measure' && <label>Units<select aria-label="Measure units" value={object.units} onChange={(event) => updateObject(object.id, { units: event.target.value as 'pt' | 'in' | 'cm' })}><option value="pt">Points</option><option value="in">Inches</option><option value="cm">Centimeters</option></select></label>}<button onClick={() => removeObject(object.id)}>Remove</button></div>)}</aside>;
}

function Navigator({ document, pdf, outline, selectedPage, onSelectPage }: { document?: { name: string; data: ArrayBuffer }; pdf?: PDFDocumentProxy; outline: OutlineItem[]; selectedPage: number; onSelectPage: (page: number) => void }) {
  const { leftPanel, setLeftPanel } = useAppStore();
  return <aside className="left-panel" aria-label="Document navigation"><div className="panel-tabs"><button aria-label="Thumbnails" className={leftPanel === 'thumbnails' ? 'selected' : ''} onClick={() => setLeftPanel('thumbnails')}><FileText size={17} /></button><button aria-label="Outline" className={leftPanel === 'outline' ? 'selected' : ''} onClick={() => setLeftPanel('outline')}><ListTree size={17} /></button></div>
    {leftPanel === 'thumbnails' ? <Thumbnails document={document} pdf={pdf} selectedPage={selectedPage} onSelectPage={onSelectPage} /> : <Outline pdf={pdf} outline={outline} onSelectPage={onSelectPage} />}
  </aside>;
}

function Thumbnails({ document, pdf, selectedPage, onSelectPage }: { document?: { name: string }; pdf?: PDFDocumentProxy; selectedPage: number; onSelectPage: (page: number) => void }) {
  const { pageSettings } = useAppStore();
  if (!document) return <p className="empty-panel">Open a PDF to see pages</p>;
  if (!pdf) return <p className="empty-panel">Loading page thumbnails?</p>;
  const order = pageSettings.order.length ? pageSettings.order : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  return <><p className="panel-label">PAGES</p><div className="thumbnail-list">{order.map((source, index) => <Thumbnail key={`${source}-${index}`} pdf={pdf} source={source} rotation={pageSettings.rotations[source] ?? 0} page={index + 1} selected={selectedPage === index + 1} onClick={() => onSelectPage(index + 1)} />)}</div></>;
}

function Thumbnail({ pdf, source, rotation, page, selected, onClick }: { pdf: PDFDocumentProxy; source: number; rotation: number; page: number; selected: boolean; onClick: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) setVisible(true); }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    let task: ReturnType<import('pdfjs-dist').PDFPageProxy['render']> | undefined;
    void pdf.getPage(source).then(async (pdfPage) => {
      if (!alive || !canvas.current) return;
      const viewport = pdfPage.getViewport({ scale: .18, rotation: (pdfPage.rotate + rotation) % 360 });
      canvas.current.width = viewport.width; canvas.current.height = viewport.height;
      task = pdfPage.render({ canvas: canvas.current, viewport });
      await task.promise;
    }).catch(() => undefined);
    return () => { alive = false; task?.cancel(); };
  }, [pdf, source, rotation, visible]);
  return <button className={`thumbnail ${selected ? 'active' : ''}`} aria-label={`Go to page ${page}`} onClick={onClick}><canvas ref={canvas} className="mini-page" /><span>{page}</span></button>;
}

function Outline({ pdf, outline, onSelectPage }: { pdf?: PDFDocumentProxy; outline: OutlineItem[]; onSelectPage: (page: number) => void }) {
  if (!pdf) return <p className="empty-panel">Open a PDF to view its outline</p>;
  if (!outline.length) return <p className="empty-panel">This document has no outline.</p>;
  return <><p className="panel-label">OUTLINE</p>{outline.map((item, index) => <OutlineItemView key={`${item.title}-${index}`} item={item} pdf={pdf} onSelectPage={onSelectPage} />)}</>;
}

function OutlineItemView({ item, pdf, onSelectPage }: { item: OutlineItem; pdf: PDFDocumentProxy; onSelectPage: (page: number) => void }) {
  const order = useAppStore((state) => state.pageSettings.order);
  const navigate = async () => { if (!item.dest) return; const destination = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest; const ref = destination?.[0]; if (ref == null) return; const source = typeof ref === 'number' ? ref + 1 : (await pdf.getPageIndex(ref)) + 1; const index = order.indexOf(source); if (index >= 0) onSelectPage(index + 1); };
  return <div className="outline-item"><button onClick={() => void navigate()}>{item.title || 'Untitled section'}</button>{item.items.map((child, index) => <OutlineItemView key={`${child.title}-${index}`} item={child} pdf={pdf} onSelectPage={onSelectPage} />)}</div>;
}

function SearchBox({ pdf, query, setQuery, hits, setHits, onSelectPage }: { pdf?: PDFDocumentProxy; query: string; setQuery: (value: string) => void; hits: SearchHit[]; setHits: (hits: SearchHit[]) => void; onSelectPage: (page: number) => void }) {
  const { pageSettings } = useAppStore();
  useEffect(() => {
    let alive = true;
    setHits([]);
    if (!pdf || !query.trim()) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const results: SearchHit[] = [];
        const order = pageSettings.order.length ? pageSettings.order : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
        for (const [index, source] of order.entries()) {
          if (!alive) return;
          const content = await (await pdf.getPage(source)).getTextContent();
          const count = findMatches(content.items.map((item) => ('str' in item ? item.str : '')).join(' '), query).length;
          if (count) results.push({ page: index + 1, count });
        }
        if (alive) setHits(results);
      })().catch(() => { if (alive) setHits([]); });
    }, 200);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [pdf, query, pageSettings.order, setHits]);
  const total = hits.reduce((sum, hit) => sum + hit.count, 0);
  return <div className="search-box"><Search size={14} /><input aria-label="Find text in document" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find in document" />{query && <><span>{total} match{total === 1 ? '' : 'es'}</span><button aria-label="Clear search" onClick={() => setQuery('')}><X size={13} /></button></>}{hits.length > 0 && <button className="next-match" onClick={() => onSelectPage(hits[0].page)}>Go to page {hits[0].page}</button>}</div>;
}
