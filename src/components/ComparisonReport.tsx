import { useState } from 'react';
import { EditorDialog } from './EditorDialog';
import type { Comparison } from '../lib/advanced';
import { assertToolSession, type ToolSession } from '../lib/toolSession';
import { downloadBlob } from '../lib/downloads';
import { useAppStore } from '../store/useAppStore';

export interface ComparisonResult {
  snapshot: ToolSession;
  otherName: string;
  pages: Comparison[];
}

export function ComparisonReport({
  report,
  onClose,
}: {
  report: ComparisonResult;
  onClose: () => void;
}) {
  const [changedOnly, setChangedOnly] = useState(true);
  const [error, setError] = useState('');
  const changed = report.pages.filter((page) => !page.equal).length;
  const pages = report.pages.filter((page) => !changedOnly || !page.equal);
  const current = () => {
    try {
      assertToolSession(report.snapshot, useAppStore.getState());
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    }
  };
  return (
    <EditorDialog title="Comparison report" onClose={onClose}>
      <p>
        {report.snapshot.document?.name} compared with {report.otherName}
      </p>
      <p>
        {changed} changed pages of {report.pages.length}. This compares extracted words and their
        order, ignoring case and punctuation. Scans need OCR; visual changes require manual review.
      </p>
      <label className="tools-check">
        <input
          aria-label="Show changed pages only"
          type="checkbox"
          checked={changedOnly}
          onChange={(event) => setChangedOnly(event.target.checked)}
        />
        Show changed pages only
      </label>
      {error && (
        <p className="tools-error" role="alert">
          {error}
        </p>
      )}
      {!pages.length && <p>No changed pages in this comparison.</p>}
      <ol className="tools-comparison-pages" aria-label="Compared pages">
        {pages.map((page) => (
          <li key={page.page}>
            <div>
              <strong>
                Page {page.page} · {page.equal ? 'Same extracted text' : 'Changed'}
              </strong>
              {page.page <= report.snapshot.pageSettings.order.length && (
                <button
                  onClick={() => {
                    if (current()) {
                      useAppStore.getState().setSelectedPage(page.page);
                      onClose();
                    }
                  }}
                >
                  Go to current page {page.page}
                </button>
              )}
            </div>
            {!page.equal && (
              <>
                <p>
                  <b>Added:</b> {page.added.slice(0, 100).join(', ') || 'No new words'}
                </p>
                <p>
                  <b>Removed:</b> {page.removed.slice(0, 100).join(', ') || 'No removed words'}
                </p>
                {!page.added.length && !page.removed.length && (
                  <p>Word order or page presence differs.</p>
                )}
                {(page.added.length > 100 || page.removed.length > 100) && (
                  <p>The downloaded report contains every detected word difference.</p>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
      <div className="advanced-actions">
        <button onClick={onClose}>Close report</button>
        <button
          className="tools-primary"
          onClick={() => {
            if (current())
              downloadBlob(
                new Blob(
                  [
                    JSON.stringify(
                      {
                        method:
                          'case-insensitive extracted-word and order comparison; punctuation ignored',
                        current: report.snapshot.document?.name,
                        compared: report.otherName,
                        changedPages: changed,
                        pages: report.pages,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                ),
                'comparison-report.json',
              );
          }}
        >
          Download comparison report
        </button>
      </div>
    </EditorDialog>
  );
}
