import { FileText, ListTree, PanelRightClose, Search, Upload, X } from 'lucide-react';
import type { DragEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { findMatches, openPdf } from '../lib/pdf';
import { PdfViewer } from './PdfViewer';
import { useAppStore } from '../store/useAppStore';
import { toPdfDocument } from '../lib/file';

export function Panels() {
  const { document, isDragging, setDragging, setDocument, setNotice, rightPanelOpen, toggleRightPanel, zoom, selectedPage, setSelectedPage, objects, addObject } = useAppStore();
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const drop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (!file) return;
    try { setDocument(await toPdfDocument(file)); } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to open that file.'); }
  };
  return <main className="workspace" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    <Navigator document={document} pdf={pdf} outline={outline} selectedPage={selectedPage} onSelectPage={setSelectedPage} />
    <section className={`canvas ${isDragging ? 'dragging' : ''}`} aria-label="Document canvas">
      <div className="ruler">0 <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span></div>
      {document ? <><SearchBox document={document} query={query} setQuery={setQuery} hits={hits} setHits={setHits} onSelectPage={setSelectedPage} /><PdfViewer document={document} zoom={zoom} selectedPage={selectedPage} objects={objects} onCreateTextObject={addObject} onDocumentLoaded={(loaded) => { setPdf(loaded); void loaded.getOutline().then((items) => setOutline(items ?? [])); }} /></> : <div className="drop-zone"><Upload size={28} /><h1>Open a PDF to begin</h1><p>Drop a PDF here, or use the Open PDF button above.</p><span>Files stay in your browser.</span></div>}
      {isDragging && <div className="drop-overlay">Drop PDF to open</div>}
    </section>
    {rightPanelOpen && <aside className="right-panel" aria-label="Properties"><button className="close-panel" onClick={toggleRightPanel}><PanelRightClose size={16} /> Hide panel</button><p className="panel-label">DOCUMENT</p><dl><dt>Status</dt><dd>{document ? 'Rendered locally' : 'No document'}</dd><dt>Pages</dt><dd>{pdf?.numPages ?? '—'}</dd><dt>Zoom</dt><dd>{zoom}%</dd><dt>Autosave</dt><dd>Every 5 seconds</dd></dl></aside>}
    {rightPanelOpen && objects.length > 0 && <ObjectEditor objects={objects} />}
  </main>;
}

interface SearchHit { page: number; count: number }
interface OutlineItem { title: string; dest?: string | unknown[] | null; items: OutlineItem[] }

function ObjectEditor({ objects }: { objects: import('../types').EditorObject[] }) {
  const { updateTextObject, updateObject, removeObject } = useAppStore();
  return <aside className="object-editor-panel" aria-label="Export objects"><p className="panel-label">EXPORT OBJECTS</p>{objects.map((object) => <div className="object-editor" key={object.id}>{object.type === 'text' && <><label>Text<input aria-label="Overlay text" value={object.text} onChange={(event) => updateTextObject(object.id, event.target.value)} /></label>{object.fallback && <span className="fallback-warning">Fallback font: Helvetica</span>}</>}{object.type === 'link' && <label>Link URL<input aria-label="Link URL" value={object.url} onChange={(event) => updateObject(object.id, { url: event.target.value })} /></label>}{object.type !== 'text' && object.type !== 'link' && <span>{object.type}</span>}<button onClick={() => removeObject(object.id)}>Remove</button></div>)}</aside>;
}

function Navigator({ document, pdf, outline, selectedPage, onSelectPage }: { document?: { name: string; data: ArrayBuffer }; pdf?: PDFDocumentProxy; outline: OutlineItem[]; selectedPage: number; onSelectPage: (page: number) => void }) {
  const { leftPanel, setLeftPanel } = useAppStore();
  return <aside className="left-panel" aria-label="Document navigation"><div className="panel-tabs"><button aria-label="Thumbnails" className={leftPanel === 'thumbnails' ? 'selected' : ''} onClick={() => setLeftPanel('thumbnails')}><FileText size={17} /></button><button aria-label="Outline" className={leftPanel === 'outline' ? 'selected' : ''} onClick={() => setLeftPanel('outline')}><ListTree size={17} /></button></div>
    {leftPanel === 'thumbnails' ? <Thumbnails document={document} pageCount={pdf?.numPages ?? 0} selectedPage={selectedPage} onSelectPage={onSelectPage} /> : <Outline pdf={pdf} outline={outline} onSelectPage={onSelectPage} />}
  </aside>;
}

function Thumbnails({ document, pageCount, selectedPage, onSelectPage }: { document?: { name: string; data: ArrayBuffer }; pageCount: number; selectedPage: number; onSelectPage: (page: number) => void }) {
  if (!document) return <p className="empty-panel">Open a PDF to see pages</p>;
  if (!pageCount) return <p className="empty-panel">Loading page thumbnails…</p>;
  return <><p className="panel-label">PAGES</p><div className="thumbnail-list">{Array.from({ length: pageCount }, (_, index) => <Thumbnail key={index + 1} document={document} page={index + 1} selected={selectedPage === index + 1} onClick={() => onSelectPage(index + 1)} />)}</div></>;
}

function Thumbnail({ document, page, selected, onClick }: { document: { name: string; data: ArrayBuffer }; page: number; selected: boolean; onClick: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let alive = true; void openPdf(document as never).then(async (pdf) => { const pdfPage = await pdf.getPage(page); if (!alive || !canvas.current) return; const viewport = pdfPage.getViewport({ scale: .18 }); canvas.current.width = viewport.width; canvas.current.height = viewport.height; await pdfPage.render({ canvas: canvas.current, viewport }).promise; }).catch(() => undefined); return () => { alive = false; }; }, [document, page]);
  return <button className={`thumbnail ${selected ? 'active' : ''}`} aria-label={`Go to page ${page}`} onClick={onClick}><canvas ref={canvas} className="mini-page" /><span>{page}</span></button>;
}

function Outline({ pdf, outline, onSelectPage }: { pdf?: PDFDocumentProxy; outline: OutlineItem[]; onSelectPage: (page: number) => void }) {
  if (!pdf) return <p className="empty-panel">Open a PDF to view its outline</p>;
  if (!outline.length) return <p className="empty-panel">This document has no outline.</p>;
  return <><p className="panel-label">OUTLINE</p>{outline.map((item, index) => <OutlineItemView key={`${item.title}-${index}`} item={item} pdf={pdf} onSelectPage={onSelectPage} />)}</>;
}

function OutlineItemView({ item, pdf, onSelectPage }: { item: OutlineItem; pdf: PDFDocumentProxy; onSelectPage: (page: number) => void }) {
  const navigate = async () => { if (!item.dest) return; const destination = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest; const ref = destination?.[0]; if (ref && typeof ref !== 'number') onSelectPage((await pdf.getPageIndex(ref)) + 1); };
  return <div className="outline-item"><button onClick={() => void navigate()}>{item.title || 'Untitled section'}</button>{item.items.map((child, index) => <OutlineItemView key={`${child.title}-${index}`} item={child} pdf={pdf} onSelectPage={onSelectPage} />)}</div>;
}

function SearchBox({ document, query, setQuery, hits, setHits, onSelectPage }: { document: { data: ArrayBuffer }; query: string; setQuery: (value: string) => void; hits: SearchHit[]; setHits: (hits: SearchHit[]) => void; onSelectPage: (page: number) => void }) {
  useEffect(() => { let alive = true; if (!query.trim()) { setHits([]); return; } void openPdf(document as never).then(async (pdf) => { const results: SearchHit[] = []; for (let page = 1; page <= pdf.numPages; page += 1) { const content = await (await pdf.getPage(page)).getTextContent(); const count = findMatches(content.items.map((item) => ('str' in item ? item.str : '')).join(' '), query).length; if (count) results.push({ page, count }); } if (alive) setHits(results); }).catch(() => alive && setHits([])); return () => { alive = false; }; }, [document, query, setHits]);
  const total = hits.reduce((sum, hit) => sum + hit.count, 0);
  return <div className="search-box"><Search size={14} /><input aria-label="Find text in document" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find in document" />{query && <><span>{total} match{total === 1 ? '' : 'es'}</span><button aria-label="Clear search" onClick={() => setQuery('')}><X size={13} /></button></>}{hits.length > 0 && <button className="next-match" onClick={() => onSelectPage(hits[0].page)}>Go to page {hits[0].page}</button>}</div>;
}
