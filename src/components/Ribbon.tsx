import { Download, FilePlus2, Moon, Redo2, Sun, Undo2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import type { RibbonTab } from '../types';
import { useAppStore } from '../store/useAppStore';
import { toPdfDocument } from '../lib/file';
import { downloadPdf, exportPdf } from '../lib/export';

const tabs: RibbonTab[] = ['File', 'Home', 'Insert', 'Layout', 'Review', 'View', 'Tools'];

export function Ribbon() {
  const { activeTab, setTab, setDocument, setNotice, undo, redo, history, future, theme, setTheme, document, objects } = useAppStore();
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
        <button aria-label="Export PDF" title="Export PDF" disabled={!document} onClick={() => { if (document) void exportPdf(document, objects).then((bytes) => { downloadPdf(bytes, document.name); setNotice('Edited PDF downloaded.'); }).catch(() => setNotice('PDF export failed.')); }}><Download size={16} /></button>
        <button aria-label="Toggle theme" title="Toggle theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
      </div>
    </div>
    <nav className="tabs" aria-label="Ribbon tabs">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setTab(tab)}>{tab}</button>)}</nav>
    <RibbonTools tab={activeTab} />
  </header>;
}

function RibbonTools({ tab }: { tab: RibbonTab }) {
  const { setZoom, zoom, toggleRightPanel, addTextObject, addObject, document, selectedPage } = useAppStore();
  const tools: Record<RibbonTab, string[]> = {
    File: [], Home: [], Insert: ['Add text overlay', 'Add shape', 'Add table', 'Add link'], Layout: [], Review: [], View: ['Zoom out', 'Zoom in', 'Properties'], Tools: [],
  };
  const activate = (tool: string) => {
    if (tool === 'Add text overlay') return addTextObject();
    if (tool === 'Add shape') return addObject({ id: crypto.randomUUID(), type: 'shape', page: selectedPage, x: 72, y: 72, width: 140, height: 80, color: '#d65737' });
    if (tool === 'Add table') return addObject({ id: crypto.randomUUID(), type: 'table', page: selectedPage, x: 72, y: 72, width: 220, height: 90, cells: [['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']] });
    if (tool === 'Add link') return addObject({ id: crypto.randomUUID(), type: 'link', page: selectedPage, x: 72, y: 72, label: 'https://example.com', url: 'https://example.com', fontSize: 12 });
    if (tool === 'Zoom out') return setZoom(zoom - 10);
    if (tool === 'Zoom in') return setZoom(zoom + 10);
    if (tool === 'Properties') return toggleRightPanel();
  };
  const addImage = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; addObject({ id: crypto.randomUUID(), type: 'image', page: selectedPage, x: 72, y: 72, width: 180, height: 120, dataUrl: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }) }); event.target.value = ''; };
  return <div className="tool-strip" aria-label={`${tab} tools`}>{tools[tab].map((tool) => <button key={tool} disabled={tool.startsWith('Add ') && !document} onClick={() => activate(tool)}>{tool}</button>)}{tab === 'Insert' && <label className="insert-image">Add image<input aria-label="Add image" type="file" accept="image/png,image/jpeg" disabled={!document} onChange={(event) => void addImage(event)} /></label>}<span className="tool-hint">{tab === 'Insert' ? 'Objects stay local and export with the PDF.' : 'Local browser workspace'}</span></div>;
}
