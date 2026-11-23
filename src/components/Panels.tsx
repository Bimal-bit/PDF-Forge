import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PdfViewer } from './PdfViewer';
import { useAppStore } from '../store/useAppStore';
import { useLocalDocumentOpen } from './useLocalDocumentOpen';
import { useViewStore } from '../store/useViewStore';
import { useViewFit } from './useViewFit';
import { DocumentNavigator } from './DocumentNavigator';
import { DocumentToolbar } from './DocumentToolbar';
import { DocumentSearch, type SearchHit } from './DocumentSearch';
import { PropertiesPanel } from './PropertiesPanel';
import type { OutlineItem } from './OutlinePanel';
import '../workspace.css';
import { useCompactWorkspace, useShortWorkspace } from './useCompactWorkspace';

export function Panels() {
  const state = useAppStore();
  const view = useViewStore();
  const opener = useLocalDocumentOpen();
  const compact = useCompactWorkspace();
  const short = useShortWorkspace();
  const { mobilePanel, setMobilePanel } = view;
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [outlineLoaded, setOutlineLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const canvas = useRef<HTMLElement>(null);
  useViewFit(pdf, canvas);
  useEffect(() => { useViewStore.setState({ mobileToolsOpen: !short }); }, [short]);
  useEffect(() => {
    if (compact) useViewStore.getState().setZoomMode('width');
    setMobilePanel(undefined);
  }, [compact, state.document?.id, setMobilePanel]);
  useEffect(() => {
    if (!view.searchFocusRequest) return;
    const frame = requestAnimationFrame(() =>
      globalThis.document
        .querySelector<HTMLInputElement>('[aria-label="Find text in document"]')
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [view.searchFocusRequest]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (globalThis.document.querySelector('dialog[open], .command-backdrop')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        useViewStore.getState().openSearch();
      }
      if (event.key === 'Escape' && !event.defaultPrevented) {
        useViewStore.setState({ readingFocus: false });
        setMobilePanel(undefined);
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [setMobilePanel]);
  useEffect(() => {
    setPdf(undefined);
    setOutline([]);
    setOutlineLoaded(false);
    setQuery('');
    setHits([]);
  }, [state.document?.id]);
  const drop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    state.setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    await opener.openFile(file);
  };
  const dimensions = {
    '--navigation-width': `${view.navigationWidth}px`,
    '--properties-width': `${view.propertiesWidth}px`,
  } as CSSProperties;
  return (
    <main
      style={dimensions}
      className={`workspace${!view.navigationOpen || view.readingFocus ? ' navigation-hidden' : ''}`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        state.setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) state.setDragging(false);
      }}
      onDrop={drop}
    >
      {!view.readingFocus && (compact ? mobilePanel === 'pages' : view.navigationOpen) && (
        <DocumentNavigator pdf={pdf} outline={outline} loaded={outlineLoaded} />
      )}
      <div className="canvas-shell">
        {compact && <div className="mobile-workspace-actions" aria-label="Mobile workspace">
          <button aria-label={view.mobileToolsOpen ? 'Hide ribbon tools' : 'Show ribbon tools'} aria-expanded={view.mobileToolsOpen} onClick={() => useViewStore.setState({ mobileToolsOpen: !view.mobileToolsOpen })}>Tools</button>
          <button aria-pressed={mobilePanel === 'pages'} onClick={() => setMobilePanel(mobilePanel === 'pages' ? undefined : 'pages')}>Pages</button>
          <button aria-pressed={mobilePanel === 'properties'} onClick={() => setMobilePanel(mobilePanel === 'properties' ? undefined : 'properties')}>Inspector</button>
          <button onClick={() => { setMobilePanel(undefined); view.openSearch(); }}>Find text</button>
          <button onClick={() => { setMobilePanel(undefined); useViewStore.setState({ ocrOpen: true, ocrEditable: true }); }}>Scan text</button>
        </div>}
        <DocumentToolbar />
        {view.readingFocus && (
          <div className="view-focus-banner">
            <span>Reading focus</span>
            <button onClick={view.toggleFocus}>Exit reading focus (Esc)</button>
          </div>
        )}
        {view.searchOpen && !view.readingFocus && (
          <DocumentSearch
            pdf={pdf}
            query={query}
            setQuery={setQuery}
            hits={hits}
            setHits={setHits}
            onSelectPage={state.setSelectedPage}
          />
        )}
        <section
          ref={canvas}
          className={`canvas ${state.isDragging ? 'dragging' : ''}`}
          id="document-canvas"
          aria-label="Document canvas"
          tabIndex={0}
        >
          {state.document && (
            <PdfViewer
              document={state.document}
              zoom={state.zoom}
              selectedPage={state.selectedPage}
              objects={state.objects}
              pageOrder={state.pageSettings.order}
              rotations={state.pageSettings.rotations}
              onCreateTextObject={state.addObject}
              onDocumentLoaded={(loaded) => {
                setPdf(loaded);
                state.initializePages(loaded.numPages);
                const id = state.document?.id;
                void loaded
                  .getOutline()
                  .then((items) => {
                    if (useAppStore.getState().document?.id === id) {
                      setOutline(items ?? []);
                      setOutlineLoaded(true);
                    }
                  })
                  .catch(() => {
                    if (useAppStore.getState().document?.id === id) {
                      setOutlineLoaded(true);
                      state.setNotice('Could not load this document outline.');
                    }
                  });
              }}
            />
          )}
          {state.isDragging && <div className="drop-overlay">Drop a PDF or image to open</div>}
        </section>
      </div>
      {!view.readingFocus && (compact ? mobilePanel === 'properties' : state.rightPanelOpen) && <PropertiesPanel ready={Boolean(pdf)} onClose={compact ? () => setMobilePanel(undefined) : undefined} />}
      {compact && mobilePanel && !view.readingFocus && <button className="mobile-panel-backdrop" aria-label="Close workspace panel" onClick={() => setMobilePanel(undefined)} />}
    </main>
  );
}
