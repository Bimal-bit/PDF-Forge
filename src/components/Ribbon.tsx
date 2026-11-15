import { FilePlus2, Moon, Redo2, Sun, Undo2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import type { RibbonTab } from '../types';
import { useAppStore } from '../store/useAppStore';
import { toPdfDocument } from '../lib/file';

const tabs: RibbonTab[] = ['File', 'Home', 'Insert', 'Layout', 'Review', 'View', 'Tools'];

export function Ribbon() {
  const { activeTab, setTab, setDocument, setNotice, undo, redo, history, future, theme, setTheme } = useAppStore();
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
        <button aria-label="Toggle theme" title="Toggle theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
      </div>
    </div>
    <nav className="tabs" aria-label="Ribbon tabs">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setTab(tab)}>{tab}</button>)}</nav>
    <RibbonTools tab={activeTab} />
  </header>;
}

function RibbonTools({ tab }: { tab: RibbonTab }) {
  const { setNotice, setZoom, zoom, toggleRightPanel } = useAppStore();
  const tools: Record<RibbonTab, string[]> = {
    File: ['Open a PDF', 'Restore recent document'], Home: ['Paste', 'Font', 'Paragraph', 'Styles'], Insert: ['Text box', 'Image', 'Shape', 'Link'],
    Layout: ['Margins', 'Orientation', 'Page size'], Review: ['Comment', 'Highlight', 'Track changes'], View: ['Zoom out', 'Zoom in', 'Properties'], Tools: ['Find', 'Inspect', 'Preferences'],
  };
  const activate = (tool: string) => {
    if (tool === 'Zoom out') return setZoom(zoom - 10);
    if (tool === 'Zoom in') return setZoom(zoom + 10);
    if (tool === 'Properties') return toggleRightPanel();
    setNotice(`${tool} is ready for implementation in its scheduled milestone.`);
  };
  return <div className="tool-strip" aria-label={`${tab} tools`}>{tools[tab].map((tool) => <button key={tool} onClick={() => activate(tool)}>{tool}</button>)}<span className="tool-hint">{tab === 'Home' ? 'Select text after opening a PDF to start editing.' : 'Local browser workspace'}</span></div>;
}
