import { FileText, ListTree } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useAppStore } from '../store/useAppStore';
import { ThumbnailList } from './ThumbnailList';
import { OutlinePanel, type OutlineItem } from './OutlinePanel';
import { PanelResizeHandle } from './PanelResizeHandle';

export function DocumentNavigator({
  pdf,
  outline,
  loaded,
}: {
  pdf?: PDFDocumentProxy;
  outline: OutlineItem[];
  loaded: boolean;
}) {
  const { leftPanel, setLeftPanel, selectedPage, pageSettings } = useAppStore();
  return (
    <aside className="left-panel" aria-label="Document navigation">
      <div className="navigation-heading">
        <strong>Navigate</strong>
        <span>{pageSettings.order.length} {pageSettings.order.length === 1 ? 'page' : 'pages'}</span>
      </div>
      <div
        className="panel-tabs"
        role="tablist"
        aria-label="Navigation view"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            setLeftPanel(leftPanel === 'thumbnails' ? 'outline' : 'thumbnails');
            const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
            buttons[leftPanel === 'thumbnails' ? 1 : 0]?.focus();
          }
        }}
      >
        <button
          role="tab"
          id="pages-tab"
          aria-label="Thumbnails"
          aria-selected={leftPanel === 'thumbnails'}
          aria-controls="navigation-content"
          tabIndex={leftPanel === 'thumbnails' ? 0 : -1}
          className={leftPanel === 'thumbnails' ? 'selected' : ''}
          onClick={() => setLeftPanel('thumbnails')}
        >
          <FileText size={14} />
          Pages
        </button>
        <button
          role="tab"
          id="outline-tab"
          aria-label="Outline"
          aria-selected={leftPanel === 'outline'}
          aria-controls="navigation-content"
          tabIndex={leftPanel === 'outline' ? 0 : -1}
          className={leftPanel === 'outline' ? 'selected' : ''}
          onClick={() => setLeftPanel('outline')}
        >
          <ListTree size={14} />
          Outline
        </button>
      </div>
      <div
        id="navigation-content"
        className="navigation-content"
        role="tabpanel"
        aria-labelledby={leftPanel === 'thumbnails' ? 'pages-tab' : 'outline-tab'}
      >
        {leftPanel === 'thumbnails' ? (
          <>
            <p className="navigation-caption">
              Page {selectedPage} of {pageSettings.order.length || 1}
            </p>
            <ThumbnailList pdf={pdf} />
          </>
        ) : (
          <OutlinePanel pdf={pdf} outline={outline} loaded={loaded} />
        )}
      </div>
      <PanelResizeHandle panel="navigation" />
    </aside>
  );
}
