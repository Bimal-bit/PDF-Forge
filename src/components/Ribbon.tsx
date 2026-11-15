import { Download, FilePlus2, Moon, Redo2, Sun, Undo2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import type { RibbonTab } from '../types';
import { useAppStore } from '../store/useAppStore';
import { toPdfDocument } from '../lib/file';
import { downloadPdf, exportPdf, mergePdfs, splitPdf } from '../lib/export';
import { exportMailMerge, parseCsv } from '../lib/forms';
import { annotationsFromXfdf, annotationsToXfdf } from '../lib/xfdf';

const tabs: RibbonTab[] = ['File', 'Home', 'Insert', 'Layout', 'Review', 'View', 'Tools'];

export function Ribbon() {
  const { activeTab, setTab, setDocument, setNotice, undo, redo, history, future, theme, setTheme, document, objects, pageSettings } = useAppStore();
  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { setDocument(await toPdfDocument(file)); } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to open that file.'); }
    event.target.value = '';
  };
  return <header className="ribbon" aria-label="Editor ribbon">
    <div className="titlebar">
      <div className="brand"><span className="brand-mark">P</span><span>PDFForge</span><span className="document-name">{useAppStore.getState().document?.name ?? 'Untitled document'}</span></div>
      <div className="title-actions">
        <button aria-label="Undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={!history.length}><Undo2 size={16} /></button>
        <button aria-label="Redo" title="Redo (Ctrl+Y)" onClick={redo} disabled={!future.length}><Redo2 size={16} /></button>
        <label className="open-button"><FilePlus2 size={16} /> Open PDF<input aria-label="Open PDF" type="file" accept="application/pdf,.pdf" onChange={openFile} /></label>
        <button aria-label="Export PDF" title="Export PDF" disabled={!document} onClick={() => { if (document) void exportPdf(document, objects, pageSettings).then((bytes) => { downloadPdf(bytes, document.name); setNotice('Edited PDF downloaded.'); }).catch(() => setNotice('PDF export failed.')); }}><Download size={16} /></button>
        <button aria-label="Toggle theme" title="Toggle theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
      </div>
    </div>
    <nav className="tabs" aria-label="Ribbon tabs">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setTab(tab)}>{tab}</button>)}</nav>
    <RibbonTools tab={activeTab} />
  </header>;
}

function RibbonTools({ tab }: { tab: RibbonTab }) {
  const { setZoom, zoom, toggleRightPanel, addTextObject, addObject, document, selectedPage, objects, importAnnotations, setNotice, movePage, rotatePage, deletePage, duplicatePage, pageSettings, updatePageSettings } = useAppStore();
  const sourcePage = pageSettings.order[selectedPage - 1] ?? selectedPage;
  const tools: Record<RibbonTab, string[]> = {
    File: [], Home: [], Insert: ['Add text overlay', 'Add shape', 'Add table', 'Add link', 'Add text field', 'Add checkbox', 'Add signature field'], Layout: [], Review: ['Highlight', 'Add comment', 'Approved stamp', 'Measure'], View: ['Zoom out', 'Zoom in', 'Properties'], Tools: ['Move page up', 'Move page down', 'Rotate page', 'Duplicate page', 'Delete page', 'Split current page'],
  };
  const activate = (tool: string) => {
    if (tool === 'Add text overlay') return addTextObject(sourcePage);
    if (tool === 'Add shape') return addObject({ id: crypto.randomUUID(), type: 'shape', page: sourcePage, x: 72, y: 72, width: 140, height: 80, color: '#d65737' });
    if (tool === 'Add table') return addObject({ id: crypto.randomUUID(), type: 'table', page: sourcePage, x: 72, y: 72, width: 220, height: 90, cells: [['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']] });
    if (tool === 'Add link') return addObject({ id: crypto.randomUUID(), type: 'link', page: sourcePage, x: 72, y: 72, label: 'https://example.com', url: 'https://example.com', fontSize: 12 });
    if (tool === 'Add text field') return addObject({ id: crypto.randomUUID(), type: 'form', kind: 'text', page: sourcePage, x: 72, y: 72, width: 180, height: 24, label: 'Field', value: '' });
    if (tool === 'Add checkbox') return addObject({ id: crypto.randomUUID(), type: 'form', kind: 'checkbox', page: sourcePage, x: 72, y: 72, width: 18, height: 18, label: 'Checkbox', value: '', checked: false });
    if (tool === 'Add signature field') return addObject({ id: crypto.randomUUID(), type: 'form', kind: 'signature', page: sourcePage, x: 72, y: 72, width: 180, height: 38, label: 'Signature', value: 'Signer name' });
    if (tool === 'Highlight') return addObject({ id: crypto.randomUUID(), type: 'highlight', page: sourcePage, x: 72, y: 72, width: 160, height: 20, color: '#f6d365', author: 'PDFForge', comment: 'Highlight' });
    if (tool === 'Add comment') return addObject({ id: crypto.randomUUID(), type: 'note', page: sourcePage, x: 72, y: 72, author: 'PDFForge', comment: 'New comment' });
    if (tool === 'Approved stamp') return addObject({ id: crypto.randomUUID(), type: 'stamp', page: sourcePage, x: 72, y: 72, label: 'APPROVED' });
    if (tool === 'Measure') return addObject({ id: crypto.randomUUID(), type: 'measure', page: sourcePage, x: 72, y: 72, width: 144, height: 0, units: 'in' });
    if (tool === 'Zoom out') return setZoom(zoom - 10);
    if (tool === 'Zoom in') return setZoom(zoom + 10);
    if (tool === 'Properties') return toggleRightPanel();
    if (tool === 'Move page up') return movePage(-1);
    if (tool === 'Move page down') return movePage(1);
    if (tool === 'Rotate page') return rotatePage();
    if (tool === 'Duplicate page') return duplicatePage();
    if (tool === 'Delete page') return deletePage();
    if (tool === 'Split current page' && document) return void splitPdf(document, [pageSettings.order[selectedPage - 1] ?? selectedPage]).then((bytes) => { downloadPdf(bytes, `${document.name.replace(/\.pdf$/i, '')}-page-${selectedPage}.pdf`); setNotice('Current page downloaded as a separate PDF.'); });
  };
  const addImage = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; addObject({ id: crypto.randomUUID(), type: 'image', page: sourcePage, x: 72, y: 72, width: 180, height: 120, dataUrl: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }) }); event.target.value = ''; };
  const exportXfdf = () => { const text = annotationsToXfdf(objects.filter((object): object is import('../types').AnnotationObject => ['highlight', 'note', 'stamp', 'measure'].includes(object.type))); const link = globalThis.document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], { type: 'application/vnd.adobe.xfdf+xml' })); link.download = 'annotations.xfdf'; link.click(); URL.revokeObjectURL(link.href); };
  const importXfdf = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { const annotations = annotationsFromXfdf(await file.text()); importAnnotations(annotations); setNotice(`${annotations.length} annotation${annotations.length === 1 ? '' : 's'} imported.`); } catch { setNotice('Could not import that XFDF file.'); } event.target.value = ''; };
  const merge = async (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); if (files.length < 2) return setNotice('Choose two or more PDFs to merge.'); try { downloadPdf(await mergePdfs(await Promise.all(files.map(toPdfDocument))), 'merged.pdf'); setNotice(`${files.length} PDFs merged locally.`); } catch { setNotice('Could not merge those PDFs.'); } event.target.value = ''; };
  const mailMerge = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || !document) return; try { const rows = parseCsv(await file.text()); if (!rows.length) return setNotice('The CSV needs a header row and at least one recipient.'); const files = await exportMailMerge(document, objects, pageSettings, rows); files.forEach(({ bytes, name }) => downloadPdf(bytes, name)); setNotice(`${files.length} recipient PDFs generated locally.`); } catch { setNotice('Could not process that CSV file.'); } event.target.value = ''; };
  const field = (label: 'header' | 'footer' | 'watermark', name: string) => <label className="page-field">{name}<input aria-label={name} value={pageSettings[label]} placeholder={label === 'header' || label === 'footer' ? 'Use {page} for page number' : 'Optional'} onChange={(event) => updatePageSettings({ [label]: event.target.value })} /></label>;
  return <div className={`tool-strip ${tab === 'Tools' ? 'tools-strip' : ''}`} aria-label={`${tab} tools`}>{tools[tab].map((tool) => <button key={tool} disabled={!document && (tool.startsWith('Add ') || tool === 'Highlight' || tool === 'Approved stamp' || tool === 'Measure' || tool.includes('page') || tool.includes('Split'))} onClick={() => activate(tool)}>{tool}</button>)}{tab === 'Insert' && <label className="insert-image">Add image<input aria-label="Add image" type="file" accept="image/png,image/jpeg" disabled={!document} onChange={(event) => void addImage(event)} /></label>}{tab === 'Review' && <><button disabled={!document} onClick={exportXfdf}>Export XFDF</button><label className="insert-image">Import XFDF<input aria-label="Import XFDF" type="file" accept=".xfdf,application/vnd.adobe.xfdf+xml,text/xml" disabled={!document} onChange={(event) => void importXfdf(event)} /></label></>}{tab === 'Tools' && <><label className="insert-image">Merge PDFs<input aria-label="Merge PDFs" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => void merge(event)} /></label><label className="insert-image">Mail merge CSV<input aria-label="Mail merge CSV" type="file" accept=".csv,text/csv" disabled={!document} onChange={(event) => void mailMerge(event)} /></label>{field('header', 'Header')}{field('footer', 'Footer')}{field('watermark', 'Watermark')}<label className="page-field">Bates start<input aria-label="Bates start" type="number" min="0" value={pageSettings.batesStart ?? ''} onChange={(event) => updatePageSettings({ batesStart: event.target.value === '' ? null : Number(event.target.value) })} /></label></>}<span className="tool-hint">{tab === 'Tools' ? 'Use {{column}} in form values, then choose a CSV to create recipient copies.' : tab === 'Review' ? 'Annotations stay local and can be shared as XFDF.' : tab === 'Insert' ? 'Fields are fillable in the editor and exported as PDF form controls.' : 'Local browser workspace'}</span></div>;
}
