import { useMemo, useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { useDialogLifetime } from './useDialogLifetime';
import { useAppStore } from '../store/useAppStore';
import { assertToolSession, type ToolSession } from '../lib/toolSession';
import { extractDisplayedPages, parsePageRanges } from '../lib/pageRanges';
import { downloadPdf } from '../lib/export';

export function ExtractPagesDialog({
  snapshot,
  onClose,
}: {
  snapshot: ToolSession;
  onClose: () => void;
}) {
  const count = snapshot.pageSettings.order.length;
  const [range, setRange] = useState(String(snapshot.selectedPage));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = useDialogLifetime();
  const preview = useMemo(() => {
    try {
      return { pages: parsePageRanges(range, count), error: '' };
    } catch (failure) {
      return { pages: [], error: (failure as Error).message };
    }
  }, [range, count]);
  const preset = (kind: 'all' | 'odd' | 'even') => {
    if (kind === 'all') setRange(`1-${count}`);
    else
      setRange(
        Array.from({ length: count }, (_, index) => index + 1)
          .filter((page) => page % 2 === (kind === 'odd' ? 1 : 0))
          .join(', '),
      );
  };
  const extract = async () => {
    if (!snapshot.document || busy) return;
    setError('');
    setBusy(true);
    try {
      assertToolSession(snapshot, useAppStore.getState());
      const bytes = await extractDisplayedPages(
        snapshot.document,
        snapshot.objects,
        snapshot.pageSettings,
        preview.pages,
      );
      if (!live.current) return;
      assertToolSession(snapshot, useAppStore.getState());
      downloadPdf(bytes, snapshot.document.name.replace(/\.pdf$/i, '') + '-extract.pdf');
      useAppStore
        .getState()
        .setNotice(`${preview.pages.length} pages extracted with current edits.`);
      onClose();
    } catch (failure) {
      if (live.current)
        setError(failure instanceof Error ? failure.message : 'Could not extract these pages.');
    } finally {
      if (live.current) setBusy(false);
    }
  };
  return (
    <EditorDialog title="Extract pages" onClose={onClose}>
      <p>
        Choose from the current {count}-page sequence. The new PDF includes edits, rotation, forms,
        and repeating marks.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void extract();
        }}
      >
        <label className="tools-range-label">
          Pages
          <input
            aria-label="Pages to extract"
            value={range}
            disabled={busy}
            onChange={(event) => {
              setRange(event.target.value);
              setError('');
            }}
            placeholder="1, 3-5, 8-6"
            autoFocus
          />
        </label>
        <div className="tools-presets">
          {(['all', 'odd', 'even'] as const).map((kind) => (
            <button
              type="button"
              key={kind}
              disabled={busy || (kind === 'even' && count < 2)}
              onClick={() => preset(kind)}
            >
              {kind === 'all' ? 'All pages' : kind === 'odd' ? 'Odd pages' : 'Even pages'}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => setRange(String(snapshot.selectedPage))}
          >
            Current page
          </button>
        </div>
        <p>
          Use commas and ranges. Descending ranges reverse their pages; repeated page numbers create
          copies. Extract up to 2,000 output pages at a time.
        </p>
        {preview.error ? (
          <p className="tools-error" role="alert">
            {preview.error}
          </p>
        ) : (
          <p aria-label="Extraction preview">
            {preview.pages.length} output pages: {preview.pages.slice(0, 40).join(', ')}
            {preview.pages.length > 40 ? ', …' : ''}
          </p>
        )}
        {error && (
          <p className="tools-error" role="alert">
            {error}
          </p>
        )}
        <div className="advanced-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="tools-primary" type="submit" disabled={busy || !preview.pages.length}>
            {busy ? 'Extracting…' : 'Download extracted PDF'}
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
